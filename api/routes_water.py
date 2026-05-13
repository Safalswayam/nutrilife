"""
Enhanced Water Intake API Routes
=================================
Improved water tracking with real-time updates and goal management
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime, date
import psycopg2
from psycopg2.extras import RealDictCursor
from index import get_db, require_auth

# Initialize router
water_router = APIRouter(prefix="/api/water", tags=["Water Intake"])


# =========================
# MODELS
# =========================

class WaterAdjustRequest(BaseModel):
    """Request to adjust water intake"""
    adjustment: int  # +1 or -1
    
    @field_validator("adjustment")
    @classmethod
    def validate_adjustment(cls, v):
        if v not in [-1, 1]:
            raise ValueError("Adjustment must be +1 or -1")
        return v


class SetWaterGoalRequest(BaseModel):
    """Request to set daily water goal"""
    goal: int
    
    @field_validator("goal")
    @classmethod
    def validate_goal(cls, v):
        if v < 1 or v > 20:
            raise ValueError("Goal must be between 1 and 20 glasses")
        return v


class WaterIntakeResponse(BaseModel):
    """Water intake response"""
    current: int
    goal: int
    date: str
    percentage: float
    goal_reached: bool
    
    class Config:
        from_attributes = True


# =========================
# HELPER FUNCTIONS
# =========================

def get_today_water_intake(user_id: int) -> dict:
    """
    Get today's water intake for user
    
    Args:
        user_id: User ID
        
    Returns:
        Dict with current intake and goal
    """
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        today = date.today()
        
        # Get user's water goal
        cur.execute("""
            SELECT daily_water_goal
            FROM users
            WHERE id = %s
        """, (user_id,))
        
        user = cur.fetchone()
        goal = user['daily_water_goal'] if user else 8
        
        # Get today's total
        cur.execute("""
            SELECT COALESCE(SUM(glasses), 0) as total
            FROM water_logs
            WHERE user_id = %s AND log_date = %s
        """, (user_id, today))
        
        result = cur.fetchone()
        current = int(result['total'])
        
        return {
            "current": current,
            "goal": goal,
            "date": today.isoformat(),
            "percentage": min(100, (current / goal * 100)) if goal > 0 else 0,
            "goal_reached": current >= goal
        }
        
    finally:
        cur.close()
        conn.close()


def update_daily_stats_water(user_id: int, glasses: int):
    """Update daily stats with water intake"""
    conn = get_db()
    cur = conn.cursor()
    
    try:
        today = date.today()
        
        cur.execute("""
            INSERT INTO daily_stats (user_id, stat_date, water_glasses, updated_at)
            VALUES (%s, %s, %s, NOW())
            ON CONFLICT (user_id, stat_date) DO UPDATE SET
                water_glasses = EXCLUDED.water_glasses,
                updated_at = NOW()
        """, (user_id, today, glasses))
        
        conn.commit()
        
    finally:
        cur.close()
        conn.close()


# =========================
# ROUTES
# =========================

@water_router.post("/adjust")
async def adjust_water_intake(
    request: WaterAdjustRequest,
    user: dict = Depends(require_auth)
):
    """
    Adjust water intake by +1 or -1 glass
    
    Features:
    - Real-time update without page reload
    - Prevents negative values
    - Updates daily stats
    - Returns updated totals
    """
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        today = date.today()
        
        # Get current total for today
        cur.execute("""
            SELECT COALESCE(SUM(glasses), 0) as current_total
            FROM water_logs
            WHERE user_id = %s AND log_date = %s
        """, (user['id'], today))
        
        result = cur.fetchone()
        current_total = int(result['current_total'])
        
        # Calculate new total
        new_total = current_total + request.adjustment
        
        # Prevent negative values
        if new_total < 0:
            cur.close()
            conn.close()
            raise HTTPException(
                status_code=400,
                detail="Water intake cannot be negative"
            )
        
        # If adjusting up, add a new log entry
        if request.adjustment > 0:
            cur.execute("""
                INSERT INTO water_logs (user_id, glasses, log_date, logged_at)
                VALUES (%s, 1, %s, NOW())
            """, (user['id'], today))
        
        # If adjusting down, remove the most recent entry
        elif request.adjustment < 0 and current_total > 0:
            cur.execute("""
                DELETE FROM water_logs
                WHERE id = (
                    SELECT id FROM water_logs
                    WHERE user_id = %s AND log_date = %s
                    ORDER BY logged_at DESC
                    LIMIT 1
                )
            """, (user['id'], today))
        
        conn.commit()
        cur.close()
        conn.close()
        
        # Update daily stats
        update_daily_stats_water(user['id'], new_total)
        
        # Get updated intake
        intake = get_today_water_intake(user['id'])
        
        return {
            "success": True,
            **intake,
            "message": f"Water intake {'increased' if request.adjustment > 0 else 'decreased'}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@water_router.get("/today", response_model=WaterIntakeResponse)
async def get_today_intake(user: dict = Depends(require_auth)):
    """
    Get today's water intake
    
    Returns:
    - Current glasses consumed
    - Daily goal
    - Percentage completed
    - Goal reached status
    """
    try:
        intake = get_today_water_intake(user['id'])
        return WaterIntakeResponse(**intake)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@water_router.post("/set-goal")
async def set_water_goal(
    request: SetWaterGoalRequest,
    user: dict = Depends(require_auth)
):
    """
    Set daily water intake goal
    
    Updates user's target for daily water consumption
    Range: 1-20 glasses
    """
    try:
        conn = get_db()
        cur = conn.cursor()
        
        cur.execute("""
            UPDATE users
            SET daily_water_goal = %s,
                updated_at = NOW()
            WHERE id = %s
        """, (request.goal, user['id']))
        
        conn.commit()
        cur.close()
        conn.close()
        
        # Get updated intake with new goal
        intake = get_today_water_intake(user['id'])
        
        return {
            "success": True,
            "message": f"Daily water goal set to {request.goal} glasses",
            **intake
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@water_router.get("/history")
async def get_water_history(
    user: dict = Depends(require_auth),
    days: int = 7
):
    """
    Get water intake history
    
    Args:
        days: Number of days to retrieve (default 7)
    
    Returns:
        Array of daily water intake data
    """
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT 
                log_date as date,
                SUM(glasses) as glasses
            FROM water_logs
            WHERE user_id = %s
            AND log_date >= CURRENT_DATE - INTERVAL '1 day' * %s
            GROUP BY log_date
            ORDER BY log_date DESC
        """, (user['id'], days))
        
        history = cur.fetchall()
        
        # Get user goal
        cur.execute("""
            SELECT daily_water_goal as goal
            FROM users
            WHERE id = %s
        """, (user['id'],))
        
        user_data = cur.fetchone()
        goal = user_data['goal'] if user_data else 8
        
        cur.close()
        conn.close()
        
        # Format response
        for entry in history:
            entry['date'] = entry['date'].isoformat()
            entry['goal'] = goal
            entry['percentage'] = min(100, (entry['glasses'] / goal * 100)) if goal > 0 else 0
            entry['goal_reached'] = entry['glasses'] >= goal
        
        return {
            "history": history,
            "days": days
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@water_router.delete("/reset-today")
async def reset_today_water(user: dict = Depends(require_auth)):
    """
    Reset today's water intake to 0
    
    Admin or debug feature
    """
    try:
        conn = get_db()
        cur = conn.cursor()
        
        today = date.today()
        
        cur.execute("""
            DELETE FROM water_logs
            WHERE user_id = %s AND log_date = %s
        """, (user['id'], today))
        
        conn.commit()
        cur.close()
        conn.close()
        
        # Update daily stats
        update_daily_stats_water(user['id'], 0)
        
        return {
            "success": True,
            "message": "Today's water intake reset to 0"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# USAGE IN MAIN APP
# =========================
"""
# In your main index.py:

from water_routes import water_router

app = FastAPI()
app.include_router(water_router)

# Now your API has:
# - POST /api/water/adjust          - Add/remove one glass
# - GET  /api/water/today            - Get today's intake
# - POST /api/water/set-goal         - Set daily goal
# - GET  /api/water/history          - Get history
# - DELETE /api/water/reset-today    - Reset today
"""
