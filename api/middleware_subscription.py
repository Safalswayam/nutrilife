"""
Subscription & Feature Access Middleware
=========================================
Middleware to enforce subscription-based feature access
"""

from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any
from datetime import datetime
import mysql.connector
from functools import wraps


security = HTTPBearer(auto_error=False)


class SubscriptionMiddleware:
    """Middleware for subscription validation"""
    
    def __init__(self, get_db_func):
        """
        Initialize middleware with database connection function
        
        Args:
            get_db_func: Function that returns database connection
        """
        self.get_db = get_db_func
    
    def check_subscription_status(self, user_id: int) -> Dict[str, Any]:
        """
        Check if user has active subscription
        
        Args:
            user_id: User ID to check
            
        Returns:
            Dict with subscription status information
        """
        conn = self.get_db()
        cur = conn.cursor(dictionary=True)
        
        try:
            # Check for active subscription
            cur.execute("""
                SELECT 
                    us.id as subscription_id,
                    us.status,
                    us.end_date,
                    sp.name as plan_name,
                    sp.duration_months,
                    DATEDIFF(us.end_date, NOW()) as days_remaining,
                    u.is_premium
                FROM users u
                LEFT JOIN user_subscriptions us ON u.id = us.user_id 
                    AND us.status = 'active'
                    AND us.end_date > NOW()
                LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
                WHERE u.id = %s
                LIMIT 1
            """, (user_id,))
            
            result = cur.fetchone()
            
            if not result:
                return {
                    "is_premium": False,
                    "has_active_subscription": False,
                    "message": "No subscription found"
                }
            
            has_active = result['subscription_id'] is not None
            
            return {
                "is_premium": bool(result['is_premium']) and has_active,
                "has_active_subscription": has_active,
                "subscription_id": result.get('subscription_id'),
                "plan_name": result.get('plan_name'),
                "expires_at": result.get('end_date'),
                "days_remaining": result.get('days_remaining', 0) if has_active else 0,
                "message": "Active subscription" if has_active else "No active subscription"
            }
            
        finally:
            cur.close()
            conn.close()
    
    def check_feature_access(self, user_id: int, feature_name: str) -> Dict[str, Any]:
        """
        Check if user has access to a specific feature
        
        Args:
            user_id: User ID
            feature_name: Name of the feature to check
            
        Returns:
            Dict with access status and details
        """
        conn = self.get_db()
        cur = conn.cursor(dictionary=True)
        
        try:
            # Get feature requirements
            cur.execute("""
                SELECT 
                    feature_name,
                    requires_premium,
                    description,
                    is_active
                FROM feature_access
                WHERE feature_name = %s AND is_active = TRUE
            """, (feature_name,))
            
            feature = cur.fetchone()
            
            if not feature:
                # Feature not found - default to allow (for backward compatibility)
                return {
                    "has_access": True,
                    "requires_premium": False,
                    "message": "Feature not restricted"
                }
            
            # If feature doesn't require premium, grant access
            if not feature['requires_premium']:
                return {
                    "has_access": True,
                    "requires_premium": False,
                    "message": "Free feature"
                }
            
            # Check subscription status
            subscription_status = self.check_subscription_status(user_id)
            
            has_access = subscription_status['is_premium']
            
            return {
                "has_access": has_access,
                "requires_premium": True,
                "subscription_status": subscription_status,
                "message": "Access granted" if has_access else "Premium subscription required",
                "feature_description": feature.get('description')
            }
            
        finally:
            cur.close()
            conn.close()
    
    def require_premium(self, feature_name: str):
        """
        Decorator to require premium subscription for an endpoint
        
        Usage:
            @app.get("/api/premium-feature")
            @middleware.require_premium("food_analyzer")
            async def premium_endpoint(user: dict = Depends(require_auth)):
                return {"data": "premium content"}
        """
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, user: dict = None, **kwargs):
                if not user:
                    raise HTTPException(
                        status_code=401,
                        detail="Authentication required"
                    )
                
                access = self.check_feature_access(user['id'], feature_name)
                
                if not access['has_access']:
                    raise HTTPException(
                        status_code=403,
                        detail={
                            "error": "Premium subscription required",
                            "feature": feature_name,
                            "message": access['message'],
                            "subscription_status": access.get('subscription_status', {}),
                            "upgrade_required": True
                        }
                    )
                
                return await func(*args, user=user, **kwargs)
            
            return wrapper
        return decorator


class FeatureGate:
    """Feature gate for checking access inline"""
    
    def __init__(self, middleware: SubscriptionMiddleware):
        self.middleware = middleware
    
    def check_access(self, user_id: int, feature_name: str) -> bool:
        """
        Quick check if user has access to feature
        
        Args:
            user_id: User ID
            feature_name: Feature name
            
        Returns:
            Boolean indicating access
        """
        result = self.middleware.check_feature_access(user_id, feature_name)
        return result['has_access']
    
    def get_blocked_features(self, user_id: int) -> list:
        """
        Get list of features user doesn't have access to
        
        Args:
            user_id: User ID
            
        Returns:
            List of blocked feature names
        """
        subscription_status = self.middleware.check_subscription_status(user_id)
        
        if subscription_status['is_premium']:
            return []
        
        # Get all premium features
        conn = self.middleware.get_db()
        cur = conn.cursor(dictionary=True)
        
        try:
            cur.execute("""
                SELECT feature_name, description
                FROM feature_access
                WHERE requires_premium = TRUE AND is_active = TRUE
            """)
            
            features = cur.fetchall()
            return [f['feature_name'] for f in features]
            
        finally:
            cur.close()
            conn.close()


def create_subscription_middleware(get_db_func):
    """
    Factory function to create subscription middleware
    
    Args:
        get_db_func: Database connection function
        
    Returns:
        Configured SubscriptionMiddleware instance
    """
    return SubscriptionMiddleware(get_db_func)


# Example usage in FastAPI routes:
"""
from middleware_subscription import create_subscription_middleware, FeatureGate

# Initialize
subscription_middleware = create_subscription_middleware(get_db)
feature_gate = FeatureGate(subscription_middleware)

# Use as dependency
@app.post("/api/analyze-food")
async def analyze_food(
    user: dict = Depends(require_auth)
):
    # Check access
    access = subscription_middleware.check_feature_access(user['id'], 'food_analyzer')
    
    if not access['has_access']:
        raise HTTPException(
            status_code=403,
            detail=access
        )
    
    # Proceed with analysis
    ...

# Or use decorator
@app.get("/api/diet-plan")
@subscription_middleware.require_premium("diet_planner")
async def get_diet_plan(user: dict = Depends(require_auth)):
    return {"plan": "premium content"}
"""
