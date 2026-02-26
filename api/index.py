from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, date, time as time_module
import bcrypt
import secrets
import hashlib
import base64
import json
import re
import os
import sys
import math
import razorpay

# ── Ensure the api/ directory is on sys.path ────────────────────────────────
# This lets Python find google_auth_service.py, subscription_service.py etc.
# regardless of whether uvicorn is run from the project root or from api/.
_API_DIR = os.path.dirname(os.path.abspath(__file__))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

# ── Load .env file FIRST before any os.getenv() calls ───────────────────────
try:
    from dotenv import load_dotenv
    _env_api  = os.path.join(_API_DIR, ".env")
    _env_root = os.path.join(os.path.dirname(_API_DIR), ".env")
    if os.path.exists(_env_api):
        load_dotenv(_env_api, override=True)
        print(f"✓ Loaded environment from {_env_api}")
    elif os.path.exists(_env_root):
        load_dotenv(_env_root, override=True)
        print(f"✓ Loaded environment from {_env_root}")
    else:
        print("⚠ No .env file found — using system environment variables only")
except ImportError:
    print("⚠ python-dotenv not installed — using system environment variables only")


import mysql.connector
from mysql.connector import pooling
from openai import OpenAI

# =========================
# APP SETUP
# =========================
app = FastAPI(title="NutriLife API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)
razorpay_client = razorpay.Client(
    auth=(
        os.getenv("RAZORPAY_KEY_ID"),
        os.getenv("RAZORPAY_KEY_SECRET")
    )
)
# =========================
# HEALTH CHECK ENDPOINT
# =========================
@app.get("/")
def health_check():
    """Health check endpoint to verify API is running"""
    return {
        "message": "NutriLife API is running",
        "version": "2.0",
        "status": "healthy",
        "endpoints": {
            "docs": "/docs",
            "auth": "/api/auth/login, /api/auth/signup",
            "dashboard": "/api/dashboard/stats",
            "food": "/api/analyze-food, /api/analyze-food-and-log",
            "profile": "/api/profile"
        }
    }

@app.get("/health")
def detailed_health():
    """Detailed health check with database connectivity"""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
        conn.close()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return {
        "api": "healthy",
        "database": db_status,
        "openai": "configured" if os.getenv("OPENROUTER_API_KEY") else "not configured"
    }


# =========================
# OPENROUTER CLIENT
# =========================
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key= os.getenv("OPENAI_API_KEY"),
    default_headers={
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Health Diet App"
    }
)

# =========================
# BASIC TEXT PROMPT
# =========================

def ask_openai(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 500,
    temperature: float = 0.4
):
    try:
        response = client.chat.completions.create(
            model="openai/gpt-4o-mini",   # ✅ OpenRouter-compatible
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=max_tokens,
            temperature=temperature
        )

        return response.choices[0].message.content

    except Exception as e:
        return f"Error: {str(e)}"


# =========================
# CHAT WITH HISTORY
# =========================

def ask_openai_with_history(
    system_prompt: str,
    messages: list,
    max_tokens: int = 1000,
    temperature: float = 0.4
) -> str:
    """Sends a conversation with history to OpenAI"""
    try:
        full_messages = [{"role": "system", "content": system_prompt}] + messages

        response = client.chat.completions.create(
            model="openai/gpt-4o-mini",   # ✅ FIXED (was invalid before)
            messages=full_messages,
            temperature=temperature,
            max_tokens=max_tokens
        )

        return response.choices[0].message.content

    except Exception as e:
        print(f"OpenRouter API error: {e}")
        return None


# =========================
# IMAGE / VISION PROMPT
# =========================

def ask_openai_with_image(
    system_prompt: str,
    user_prompt: str,
    image_base64: str,
    max_tokens: int = 900,
    detail: str = "high"
) -> str:
    """Sends a prompt with an image to OpenAI Vision for accurate food detection"""
    try:
        response = client.chat.completions.create(
            model="openai/gpt-4o",   # ✅ Vision-supported on OpenRouter
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}",
                                "detail": detail
                            }
                        }
                    ]
                }
            ],
            temperature=0.2,
            max_tokens=max_tokens
        )

        return response.choices[0].message.content

    except Exception as e:
        print(f"OpenRouter Vision API error: {e}")
        return None

# =========================
# DATABASE (MYSQL)
# =========================
DB_CONFIG = {
    "host": os.getenv("MYSQL_HOST", "localhost"),
    "user": os.getenv("MYSQL_USER", "root"),
    "password": os.getenv("MYSQL_PASSWORD", "Safal@7076"),
    "database": os.getenv("MYSQL_DATABASE", "nutrilife_db"),
    "port": int(os.getenv("MYSQL_PORT", 3306))
}

db_pool = None
db_initialized = False

def init_db_pool():
    """Initialize the database connection pool"""
    global db_pool, db_initialized
    if db_initialized and db_pool is not None:
        return True
    try:
        db_pool = pooling.MySQLConnectionPool(
            pool_name="nutrilife_pool",
            pool_size=5,
            pool_reset_session=True,
            **DB_CONFIG
        )
        db_initialized = True
        print("Database pool initialized successfully")
        return True
    except Exception as e:
        db_initialized = False
        print(f"Database pool initialization error: {e}")
        return False

def get_db():
    """Get a database connection from the pool"""
    global db_pool, db_initialized
    if not db_initialized or db_pool is None:
        if not init_db_pool():
            raise HTTPException(status_code=503, detail="Database service unavailable")
    try:
        conn = db_pool.get_connection()
        return conn
    except mysql.connector.Error as e:
        print(f"Database connection error: {e}")
        # Try to reinitialize pool on connection error
        db_initialized = False
        if init_db_pool():
            try:
                return db_pool.get_connection()
            except Exception:
                pass
        raise HTTPException(status_code=500, detail="Database connection failed")
    except Exception as e:
        print(f"Database connection error: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")

def init_database():
    """Initialize database tables"""
    try:
        conn = get_db()
        cur = conn.cursor()

        # Users table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(100) NOT NULL,
            gender VARCHAR(20),
            age INT,
            height FLOAT,
            weight FLOAT,
            activity_level VARCHAR(50),
            metabolism_type VARCHAR(50),
            goal VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE,
            failed_login_attempts INT DEFAULT 0,
            locked_until DATETIME
        )
        """)

        # Sessions table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token_hash VARCHAR(255) UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            is_valid BOOLEAN DEFAULT TRUE,
            ip_address VARCHAR(50),
            user_agent VARCHAR(500),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        # Meal logs table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS meal_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            food_name VARCHAR(200) NOT NULL,
            calories INT,
            protein FLOAT,
            carbs FLOAT,
            fat FLOAT,
            meal_type VARCHAR(50),
            logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        # Chat history table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            role VARCHAR(20) NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        # Saved diet plans table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS saved_diet_plans (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            plan_data JSON NOT NULL,
            name VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        # Water intake tracking table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS water_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            glasses INT DEFAULT 1,
            logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            log_date DATE NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_user_date (user_id, log_date)
        )
        """)

        # Daily stats tracking table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS daily_stats (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            stat_date DATE NOT NULL,
            total_calories INT DEFAULT 0,
            total_protein FLOAT DEFAULT 0,
            total_carbs FLOAT DEFAULT 0,
            total_fat FLOAT DEFAULT 0,
            total_fiber FLOAT DEFAULT 0,
            water_glasses INT DEFAULT 0,
            weight FLOAT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_user_date (user_id, stat_date)
        )
        """)

        # Food analysis history table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS food_analysis_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            food_items JSON NOT NULL,
            total_calories INT,
            total_protein FLOAT,
            total_carbs FLOAT,
            total_fat FLOAT,
            total_fiber FLOAT,
            image_url VARCHAR(500),
            analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        # ── Subscription plans table ─────────────────────────────────────────
        cur.execute("""
        CREATE TABLE IF NOT EXISTS subscription_plans (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(50) NOT NULL,
            duration_months INT NOT NULL,
            base_price DECIMAL(10,2) NOT NULL,
            final_price DECIMAL(10,2) NOT NULL,
            discount_amount DECIMAL(10,2) DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            features JSON,
            badge VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_duration (duration_months)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)

        # Seed default plans if table is empty
        cur.execute("SELECT COUNT(*) as cnt FROM subscription_plans")
        row = cur.fetchone()
        count = row['cnt'] if isinstance(row, dict) else row[0]
        if count == 0:
            cur.execute("""
            INSERT INTO subscription_plans
                (name, duration_months, base_price, final_price, discount_amount, badge, features)
            VALUES
                ('3 Month Plan',  3,  299.00,  299.00,    0.00, NULL,
                 '["AI Food Analyzer","Diet Planner","Advanced Analytics","Priority Support"]'),
                ('6 Month Plan',  6,  598.00,  549.00,   49.00, '⭐ Popular',
                 '["AI Food Analyzer","Diet Planner","Advanced Analytics","Priority Support","Save ₹49"]'),
                ('1 Year Plan',  12, 1196.00,  849.00,  347.00, '🔥 Best Value',
                 '["AI Food Analyzer","Diet Planner","Advanced Analytics","Priority Support","Save ₹347","Best Value"]')
            ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
            """)
            print("  ✓ Seeded default subscription plans")

        # ── User subscriptions table ─────────────────────────────────────────
        cur.execute("""
        CREATE TABLE IF NOT EXISTS user_subscriptions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            plan_id INT NOT NULL,
            status ENUM('active','expired','cancelled','pending') DEFAULT 'pending',
            start_date DATETIME NOT NULL,
            end_date DATETIME NOT NULL,
            auto_renew BOOLEAN DEFAULT FALSE,
            cancelled_at DATETIME,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
            INDEX idx_user_status (user_id, status),
            INDEX idx_end_date (end_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)

        # ── Payment transactions table ───────────────────────────────────────
        cur.execute("""
        CREATE TABLE IF NOT EXISTS payment_transactions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            subscription_id INT,
            plan_id INT NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            currency VARCHAR(3) DEFAULT 'INR',
            payment_status ENUM('pending','completed','failed','refunded') DEFAULT 'pending',
            payment_method VARCHAR(50),
            transaction_id VARCHAR(255) UNIQUE,
            payment_gateway VARCHAR(50),
            gateway_response JSON,
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
            INDEX idx_user_id (user_id),
            INDEX idx_status (payment_status),
            INDEX idx_transaction_id (transaction_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)

        # ── Feature access table ─────────────────────────────────────────────
        cur.execute("""
        CREATE TABLE IF NOT EXISTS feature_access (
            id INT AUTO_INCREMENT PRIMARY KEY,
            feature_name VARCHAR(100) NOT NULL UNIQUE,
            requires_premium BOOLEAN DEFAULT TRUE,
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)

        # Seed feature access rules if empty
        cur.execute("SELECT COUNT(*) as cnt FROM feature_access")
        row = cur.fetchone()
        count = row['cnt'] if isinstance(row, dict) else row[0]
        if count == 0:
            cur.execute("""
            INSERT INTO feature_access (feature_name, requires_premium, description) VALUES
                ('food_analyzer',       TRUE,  'AI-powered food image analysis'),
                ('diet_planner',        FALSE, 'AI-generated personalized meal plans'),
                ('advanced_analytics',  TRUE,  'Detailed nutritional analytics'),
                ('water_tracker',       FALSE, 'Basic water intake tracking'),
                ('calorie_tracking',    FALSE, 'Manual calorie tracking'),
                ('dashboard',           FALSE, 'Basic dashboard view')
            ON DUPLICATE KEY UPDATE requires_premium = VALUES(requires_premium)
            """)
            # Ensure diet_planner is always free even if row already existed
            cur.execute("UPDATE feature_access SET requires_premium = FALSE WHERE feature_name = 'diet_planner'")
            print("  ✓ Seeded feature access rules")

        # ── Subscription audit log ───────────────────────────────────────────
        cur.execute("""
        CREATE TABLE IF NOT EXISTS subscription_audit_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            subscription_id INT,
            action VARCHAR(50) NOT NULL,
            old_status VARCHAR(50),
            new_status VARCHAR(50),
            details JSON,
            ip_address VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_user_action (user_id, action)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)

        # ── NEW: Safely add columns one-by-one using INFORMATION_SCHEMA ────────
        # This works on ALL MySQL versions (5.6, 5.7, 8.x) unlike IF NOT EXISTS
        def _add_column_if_missing(table, column, definition):
            cur.execute("""
                SELECT COUNT(*) as cnt
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME   = %s
                  AND COLUMN_NAME  = %s
            """, (table, column))
            row = cur.fetchone()
            count = row['cnt'] if isinstance(row, dict) else row[0]
            if count == 0:
                cur.execute(f"ALTER TABLE `{table}` ADD COLUMN `{column}` {definition}")
                print(f"  ✓ Added column {table}.{column}")

        new_user_columns = [
            ("subscription_status",        "ENUM('inactive','active','cancelled') NOT NULL DEFAULT 'inactive'"),
            ("razorpay_customer_id",        "VARCHAR(255)"),
            ("razorpay_subscription_id",    "VARCHAR(255)"),
            ("payment_id",                  "VARCHAR(255)"),
            ("subscription_start_date",     "DATETIME"),
            ("subscription_end_date",       "DATETIME"),
            ("google_id",                   "VARCHAR(255)"),
            ("profile_image",               "VARCHAR(500)"),
            ("auth_provider",               "VARCHAR(50) DEFAULT 'email'"),
            ("is_premium",                  "BOOLEAN NOT NULL DEFAULT FALSE"),
            ("subscription_expires_at",     "DATETIME"),
            ("fasting_plan",               "VARCHAR(50) DEFAULT 'none'"),
            ("daily_water_goal",            "INT DEFAULT 8"),
        ]
        for col_name, col_def in new_user_columns:
            try:
                _add_column_if_missing("users", col_name, col_def)
            except Exception as col_err:
                print(f"  ⚠ Could not add column users.{col_name}: {col_err}")

        # ── NEW: Webhook event dedup log ─────────────────────────────────────
        cur.execute("""
        CREATE TABLE IF NOT EXISTS razorpay_webhook_events (
            id INT AUTO_INCREMENT PRIMARY KEY,
            event_id VARCHAR(255) UNIQUE NOT NULL,
            event_type VARCHAR(100) NOT NULL,
            payload JSON NOT NULL,
            processed BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)


        # ── Fasting sessions table ───────────────────────────────────────────
        cur.execute("""
        CREATE TABLE IF NOT EXISTS fasting_sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            plan_type VARCHAR(50) NOT NULL DEFAULT 'none',
            start_time DATETIME NOT NULL,
            end_time DATETIME,
            target_end_time DATETIME,
            completed BOOLEAN DEFAULT FALSE,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_user_fasting (user_id, start_time)
        )
        """)

        conn.commit()
        cur.close()
        conn.close()
        print("Database tables initialized successfully")
        return True
    except mysql.connector.Error as e:
        print(f"Database initialization error: {e}")
        return False
    except Exception as e:
        print(f"Database initialization error: {e}")
        return False

# Initialize database on startup (graceful - won't crash if DB unavailable)
def startup_init():
    """Initialize database connection and tables on startup"""
    if init_db_pool():
        init_database()
    else:
        print("Warning: Database not available. Some features may not work.")

startup_init()

# =========================
# INITIALIZE NEW SERVICES (Subscription & Google Auth)
# =========================
google_auth_service = None
subscription_service = None
subscription_middleware = None

try:
    from google_auth_service import GoogleAuthService
    from subscription_service import SubscriptionService
    from middleware_subscription import create_subscription_middleware
    
    google_auth_service = GoogleAuthService(get_db, os.getenv("GOOGLE_CLIENT_ID", ""))
    subscription_service = SubscriptionService(get_db)
    subscription_middleware = create_subscription_middleware(get_db)
    print("✓ Subscription and Google Auth services initialized successfully")
except ImportError as e:
    print(f"⚠ Optional features not loaded (install dependencies): {e}")
except Exception as e:
    print(f"⚠ Service initialization warning: {e}")

# =========================
# SECURITY HELPERS
# =========================
def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against bcrypt hash"""
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except Exception:
        return False

def generate_token() -> str:
    """Generate a secure random session token"""
    return secrets.token_urlsafe(64)

def hash_token(token: str) -> str:
    """Hash session token for storage"""
    return hashlib.sha256(token.encode()).hexdigest()

def sanitize_input(value: str, max_length: int = 500) -> str:
    """Sanitize user input"""
    if not value:
        return ""
    value = value.replace('\x00', '')
    return value[:max_length].strip()

def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email)) and len(email) <= 254

def validate_password_strength(password: str) -> tuple:
    """Check password meets security requirements"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if len(password) > 128:
        return False, "Password must be less than 128 characters"
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r'\d', password):
        return False, "Password must contain at least one number"
    return True, "Password is strong"

# =========================
# AUTH DEPENDENCY
# =========================
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current authenticated user from token"""
    if not credentials:
        return None
    
    token_hash = hash_token(credentials.credentials)
    
    try:
        conn = get_db()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT u.id, u.email, u.name, u.gender, u.age, u.height, u.weight,
                   u.activity_level, u.metabolism_type, u.goal,
                   COALESCE(u.is_premium, FALSE)            AS is_premium,
                   COALESCE(u.subscription_status,'inactive') AS subscription_status,
                   u.subscription_expires_at,
                   u.profile_image, u.auth_provider,
                   u.razorpay_subscription_id,
                   u.subscription_start_date,
                   u.subscription_end_date
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = %s
              AND s.is_valid = TRUE
              AND s.expires_at > NOW()
        """, (token_hash,))

        user = cur.fetchone()
        cur.close()
        conn.close()

        return user
    except Exception as e:
        print(f"Auth error: {e}")
        return None

def require_auth(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Require authentication - raises exception if not authenticated"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user = get_current_user(credentials)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return user


def require_premium(user: dict = Depends(require_auth)):
    """
    Require both authentication AND an active subscription.
    Returns 403 if the user is authenticated but not subscribed.
    Does NOT break existing require_auth usage.
    """
    sub_status = user.get("subscription_status", "inactive")
    is_premium = user.get("is_premium", False)

    # Also honour legacy is_premium flag (existing subscriptions activated before this migration)
    if sub_status != "active" and not is_premium:
        raise HTTPException(
            status_code=403,
            detail="Premium subscription required. Please subscribe to access this feature."
        )
    return user

# =========================
# MODELS
# =========================
class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    gender: Optional[str] = None
    age: Optional[int] = None
    height: Optional[float] = None
    weight: Optional[float] = None

    @field_validator("email")
    @classmethod
    def validate_email_field(cls, v: str) -> str:
        if not validate_email(v):
          raise ValueError("Invalid email format")
        return v.lower().strip()

    @field_validator("name")
    @classmethod
    def validate_name_field(cls, v: str) -> str:
        if not v or len(v.strip()) < 2:
          raise ValueError("Name must be at least 2 characters")
        return sanitize_input(v, 100)

class LoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    success: bool
    message: str
    token: Optional[str] = None
    user: Optional[dict] = None

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    activity_level: Optional[str] = None
    metabolism_type: Optional[str] = None
    goal: Optional[str] = None

class FoodAnalysisRequest(BaseModel):
    description: Optional[str] = None
    image_base64: Optional[str] = None

class NutritionInfo(BaseModel):
    calories: int
    protein: float
    carbs: float
    fat: float
    fiber: float
    sugar: float
    sodium: float

class FoodItem(BaseModel):
    name: str
    portion: str
    calories: int

class FoodAnalysisResponse(BaseModel):
    success: bool
    food_name: str
    portion_size: str
    nutrition: NutritionInfo
    items: List[FoodItem]
    health_benefits: List[str]
    warnings: List[str]
    healthier_alternatives: List[str]
    meal_category: str

class ChatMessage(BaseModel):
    role: str
    content: str

class HealthChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []

class SymptomAnalysis(BaseModel):
    detected_symptoms: List[str]
    severity: str
    possible_conditions: List[str]
    remedies: List[str]
    preventive_measures: List[str]
    should_consult_doctor: bool
    urgency: str

class HealthChatResponse(BaseModel):
    success: bool
    response: str
    symptom_analysis: Optional[SymptomAnalysis] = None

class DietPlanRequest(BaseModel):
    gender: str
    age: int
    height: float
    weight: float
    activity_level: str
    metabolism_type: str
    goal: str
    diet_type: str = "non_veg"   # veg | non_veg | vegan | jain
    dietary_restrictions: List[str] = []
    fasting_plan: Optional[str] = "none"  # none | 12:12 | 14:10 | 16:8 | 18:6 | 20:4 | omad | 5:2 | alternate

class BatchLogRequest(BaseModel):
    items: List[dict]          # [{name, calories, portion}]
    nutrition: dict            # {protein, carbs, fat, fiber}
    meal_type: str = "meal"

class Meal(BaseModel):
    name: str
    calories: int
    protein: float
    carbs: float
    fat: float
    ingredients: List[str]
    preparation_time: str

class DayPlan(BaseModel):
    day: str
    breakfast: Meal
    morning_snack: Meal
    lunch: Meal
    afternoon_snack: Meal
    dinner: Meal
    total_calories: int

class BMIResult(BaseModel):
    bmi: float
    category: str
    healthy_weight_range: str

class DietPlanResponse(BaseModel):
    success: bool
    bmi_result: BMIResult
    bmr: float
    tdee: float
    target_calories: int
    macro_targets: dict
    weekly_plan: List[DayPlan]
    tips: List[str]

# =========================
# FOOD DATABASE
# =========================
FOOD_DATABASE = {
    "pizza": {"calories": 285, "protein": 12, "carbs": 36, "fat": 10, "fiber": 2.5, "sugar": 4, "sodium": 640},
    "burger": {"calories": 354, "protein": 17, "carbs": 29, "fat": 17, "fiber": 1.3, "sugar": 5, "sodium": 497},
    "cheeseburger": {"calories": 410, "protein": 22, "carbs": 32, "fat": 22, "fiber": 1.5, "sugar": 6, "sodium": 750},
    "french fries": {"calories": 365, "protein": 4, "carbs": 48, "fat": 17, "fiber": 4, "sugar": 0.3, "sodium": 246},
    "fried chicken": {"calories": 320, "protein": 25, "carbs": 12, "fat": 20, "fiber": 0.5, "sugar": 0, "sodium": 590},
    "pasta": {"calories": 220, "protein": 8, "carbs": 43, "fat": 1.3, "fiber": 2.5, "sugar": 1, "sodium": 1},
    "spaghetti": {"calories": 310, "protein": 11, "carbs": 58, "fat": 5, "fiber": 3, "sugar": 6, "sodium": 480},
    "lasagna": {"calories": 377, "protein": 21, "carbs": 35, "fat": 17, "fiber": 3, "sugar": 6, "sodium": 710},
    "sushi": {"calories": 200, "protein": 8, "carbs": 38, "fat": 1, "fiber": 1, "sugar": 8, "sodium": 450},
    "ramen": {"calories": 436, "protein": 18, "carbs": 58, "fat": 15, "fiber": 3, "sugar": 2, "sodium": 1820},
    "fried rice": {"calories": 333, "protein": 8, "carbs": 48, "fat": 12, "fiber": 2, "sugar": 3, "sodium": 820},
    "curry": {"calories": 280, "protein": 15, "carbs": 18, "fat": 18, "fiber": 3, "sugar": 5, "sodium": 650},
    "biryani": {"calories": 350, "protein": 15, "carbs": 48, "fat": 12, "fiber": 2, "sugar": 2, "sodium": 680},
    "butter chicken": {"calories": 380, "protein": 28, "carbs": 12, "fat": 25, "fiber": 2, "sugar": 6, "sodium": 720},
    "naan": {"calories": 262, "protein": 9, "carbs": 45, "fat": 5, "fiber": 2, "sugar": 3, "sodium": 418},
    "dal": {"calories": 198, "protein": 12, "carbs": 32, "fat": 3, "fiber": 8, "sugar": 3, "sodium": 420},
    "chicken": {"calories": 239, "protein": 27, "carbs": 0, "fat": 14, "fiber": 0, "sugar": 0, "sodium": 82},
    "chicken breast": {"calories": 165, "protein": 31, "carbs": 0, "fat": 3.6, "fiber": 0, "sugar": 0, "sodium": 74},
    "steak": {"calories": 271, "protein": 26, "carbs": 0, "fat": 18, "fiber": 0, "sugar": 0, "sodium": 54},
    "salmon": {"calories": 208, "protein": 20, "carbs": 0, "fat": 13, "fiber": 0, "sugar": 0, "sodium": 59},
    "eggs": {"calories": 155, "protein": 13, "carbs": 1.1, "fat": 11, "fiber": 0, "sugar": 1.1, "sodium": 124},
    "omelette": {"calories": 220, "protein": 15, "carbs": 2, "fat": 17, "fiber": 0, "sugar": 1, "sodium": 320},
    "rice": {"calories": 206, "protein": 4.3, "carbs": 45, "fat": 0.4, "fiber": 0.6, "sugar": 0, "sodium": 1},
    "bread": {"calories": 79, "protein": 2.7, "carbs": 15, "fat": 1, "fiber": 0.6, "sugar": 1.5, "sodium": 142},
    "salad": {"calories": 152, "protein": 4, "carbs": 12, "fat": 10, "fiber": 4, "sugar": 6, "sodium": 283},
    "fruit": {"calories": 65, "protein": 0.8, "carbs": 17, "fat": 0.2, "fiber": 2.4, "sugar": 13, "sodium": 1},
    "apple": {"calories": 95, "protein": 0.5, "carbs": 25, "fat": 0.3, "fiber": 4, "sugar": 19, "sodium": 2},
    "banana": {"calories": 105, "protein": 1.3, "carbs": 27, "fat": 0.4, "fiber": 3, "sugar": 14, "sodium": 1},
    "yogurt": {"calories": 100, "protein": 17, "carbs": 6, "fat": 0.7, "fiber": 0, "sugar": 6, "sodium": 65},
    "ice cream": {"calories": 207, "protein": 4, "carbs": 24, "fat": 11, "fiber": 0.7, "sugar": 21, "sodium": 80},
    "cake": {"calories": 352, "protein": 5, "carbs": 52, "fat": 14, "fiber": 1, "sugar": 36, "sodium": 299},
    "coffee": {"calories": 2, "protein": 0.3, "carbs": 0, "fat": 0, "fiber": 0, "sugar": 0, "sodium": 5},
    "smoothie": {"calories": 230, "protein": 6, "carbs": 45, "fat": 3, "fiber": 4, "sugar": 35, "sodium": 80},
    "default": {"calories": 250, "protein": 10, "carbs": 30, "fat": 10, "fiber": 3, "sugar": 5, "sodium": 400},
}

HEALTH_BENEFITS = {
    "salad": ["Rich in vitamins and minerals", "High fiber aids digestion", "Low calorie option"],
    "chicken": ["High quality lean protein", "Supports muscle growth", "Contains B vitamins"],
    "salmon": ["Rich in omega-3 fatty acids", "Supports heart health", "Good for brain function"],
    "eggs": ["Complete protein source", "Contains choline for brain health", "Rich in vitamin D"],
    "yogurt": ["Contains probiotics", "Good source of calcium", "Supports gut health"],
    "fruit": ["Natural energy source", "High in vitamin C", "Contains antioxidants"],
    "dal": ["Excellent plant protein", "High in fiber", "Rich in iron"],
}

FOOD_WARNINGS = {
    "pizza": ["High in sodium", "Contains saturated fat", "Processed ingredients"],
    "burger": ["High calorie density", "May contain trans fats", "High sodium"],
    "fried chicken": ["High in saturated fat", "Deep fried in oil", "High sodium"],
    "french fries": ["High in unhealthy fats", "High glycemic index", "High sodium"],
    "ramen": ["Very high in sodium", "Contains MSG", "Low nutritional value"],
    "ice cream": ["High in sugar", "High in saturated fat", "Calorie dense"],
    "cake": ["High in sugar", "Contains refined carbs", "Low nutritional value"],
}

HEALTHIER_ALTERNATIVES = {
    "pizza": ["Cauliflower crust pizza", "Veggie-loaded thin crust", "Homemade with whole wheat"],
    "burger": ["Turkey burger", "Grilled chicken sandwich", "Veggie burger"],
    "fried chicken": ["Grilled chicken", "Baked chicken", "Air-fried chicken"],
    "french fries": ["Baked sweet potato fries", "Air-fried potatoes", "Roasted vegetables"],
    "pasta": ["Whole wheat pasta", "Zucchini noodles", "Chickpea pasta"],
    "rice": ["Brown rice", "Cauliflower rice", "Quinoa"],
}


# =========================
# FASTING PLANS REGISTRY
# =========================
FASTING_PLANS = {
    "none": {
        "id": "none", "name": "No Fasting", "emoji": "🍽️",
        "fast_hours": 0, "eat_hours": 24,
        "category": "No Restriction", "difficulty": "None",
        "description": "No fasting — eat freely throughout the day.",
        "suitable_for": "Everyone, especially beginners",
        "benefits": ["No restrictions", "Flexible eating"],
        "tips": ["Focus on balanced nutrition", "Stay hydrated"],
    },
    "12:12": {
        "id": "12:12", "name": "12:12 Beginner Fast", "emoji": "🌙",
        "fast_hours": 12, "eat_hours": 12,
        "category": "Beginner", "difficulty": "Easy",
        "description": "Fast for 12 hours, eat within a 12-hour window. Great starting point.",
        "suitable_for": "Absolute beginners, people with busy schedules",
        "benefits": ["Improves sleep quality", "Regulates blood sugar", "Easy to maintain"],
        "tips": ["Skip late-night snacking", "Align fast with sleep hours"],
    },
    "14:10": {
        "id": "14:10", "name": "14:10 Beginner+", "emoji": "🕑",
        "fast_hours": 14, "eat_hours": 10,
        "category": "Beginner", "difficulty": "Easy",
        "description": "14-hour fast with a 10-hour eating window.",
        "suitable_for": "Beginners ready to progress",
        "benefits": ["Fat burning begins", "Mental clarity", "Better digestion"],
        "tips": ["Drink water during fast", "Break fast with protein"],
    },
    "16:8": {
        "id": "16:8", "name": "16:8 Leangains", "emoji": "⏰",
        "fast_hours": 16, "eat_hours": 8,
        "category": "Intermediate", "difficulty": "Moderate",
        "description": "16-hour fast, 8-hour eating window. The most popular IF protocol.",
        "suitable_for": "Most adults, weight loss, muscle gain",
        "benefits": ["Significant fat loss", "Improved insulin sensitivity", "Muscle preservation"],
        "tips": ["Eat noon to 8pm", "Include protein at every meal", "Black coffee/tea is fine during fast"],
    },
    "18:6": {
        "id": "18:6", "name": "18:6 Advanced", "emoji": "🔥",
        "fast_hours": 18, "eat_hours": 6,
        "category": "Advanced", "difficulty": "Hard",
        "description": "18-hour fast with a 6-hour eating window.",
        "suitable_for": "Experienced IF practitioners",
        "benefits": ["Deep ketosis", "Enhanced autophagy", "Rapid fat loss"],
        "tips": ["Eat 2-3 meals in window", "High protein intake essential", "Electrolytes are important"],
    },
    "20:4": {
        "id": "20:4", "name": "20:4 Warrior Diet", "emoji": "⚔️",
        "fast_hours": 20, "eat_hours": 4,
        "category": "Advanced", "difficulty": "Very Hard",
        "description": "20-hour fast, 4-hour eating window based on the Warrior Diet.",
        "suitable_for": "Advanced practitioners only",
        "benefits": ["Maximum fat oxidation", "Hormonal optimization", "Discipline building"],
        "tips": ["One large meal + small snack", "Very high protein needed", "Not for beginners"],
    },
    "omad": {
        "id": "omad", "name": "OMAD (One Meal a Day)", "emoji": "🥗",
        "fast_hours": 23, "eat_hours": 1,
        "category": "Extreme", "difficulty": "Extreme",
        "description": "Eat one large meal per day within a 1-hour window.",
        "suitable_for": "Experienced IF practitioners only",
        "benefits": ["Maximum caloric restriction", "Simplicity", "Insulin reset"],
        "tips": ["Nutrient-dense single meal", "Avoid if diabetic", "Consult a doctor first"],
    },
    "5:2": {
        "id": "5:2", "name": "5:2 Diet", "emoji": "📅",
        "fast_hours": 0, "eat_hours": 24,
        "category": "Weekly", "difficulty": "Moderate",
        "description": "Eat normally 5 days, restrict to 500-600 kcal on 2 non-consecutive days.",
        "suitable_for": "People who prefer occasional fasting",
        "benefits": ["Flexible", "Sustainable long-term", "Good for metabolic health"],
        "tips": ["Fast on Mon & Thu", "High-protein on fast days", "Drink plenty of water"],
    },
    "alternate": {
        "id": "alternate", "name": "Alternate Day Fasting", "emoji": "🔄",
        "fast_hours": 0, "eat_hours": 24,
        "category": "Weekly", "difficulty": "Hard",
        "description": "Alternate between full fasting days (~500 kcal) and normal eating days.",
        "suitable_for": "Intermediate to advanced practitioners",
        "benefits": ["Rapid weight loss", "Metabolic flexibility", "Autophagy benefits"],
        "tips": ["Stay very hydrated on fast days", "Do not exercise intensely on fast days", "Track carefully"],
    },
}

SYMPTOM_DATABASE = {
    "headache": {
        "severity": "low",
        "conditions": ["Tension headache", "Migraine", "Dehydration", "Eye strain"],
        "remedies": ["Rest in a dark room", "Stay hydrated", "Take OTC pain relievers", "Apply cold compress"],
        "prevention": ["Regular sleep schedule", "Stay hydrated", "Manage stress", "Limit screen time"],
        "consult_if": "Severe, sudden, or accompanied by fever, stiff neck, or vision changes"
    },
    "fever": {
        "severity": "medium",
        "conditions": ["Viral infection", "Bacterial infection", "Flu", "COVID-19"],
        "remedies": ["Rest", "Stay hydrated", "Take fever reducers", "Cool compress"],
        "prevention": ["Wash hands frequently", "Get vaccinated", "Avoid sick contacts"],
        "consult_if": "Temperature above 103F, lasts more than 3 days, or with severe symptoms"
    },
    "cough": {
        "severity": "low",
        "conditions": ["Common cold", "Allergies", "Bronchitis", "Asthma"],
        "remedies": ["Honey and warm water", "Stay hydrated", "Use humidifier", "Throat lozenges"],
        "prevention": ["Avoid irritants", "Don't smoke", "Wash hands", "Stay away from sick people"],
        "consult_if": "Persistent for more than 3 weeks, blood in mucus, or difficulty breathing"
    },
    "stomach pain": {
        "severity": "medium",
        "conditions": ["Indigestion", "Gastritis", "Food poisoning", "IBS"],
        "remedies": ["Eat bland foods", "Avoid spicy foods", "Drink ginger tea", "Rest"],
        "prevention": ["Eat slowly", "Avoid trigger foods", "Stay hydrated", "Manage stress"],
        "consult_if": "Severe pain, blood in stool, persistent vomiting, or fever"
    },
    "fatigue": {
        "severity": "low",
        "conditions": ["Lack of sleep", "Anemia", "Thyroid issues", "Depression"],
        "remedies": ["Get adequate sleep", "Exercise regularly", "Eat balanced meals", "Reduce stress"],
        "prevention": ["Regular sleep schedule", "Balanced diet", "Regular exercise", "Limit caffeine"],
        "consult_if": "Persistent fatigue lasting more than 2 weeks despite adequate rest"
    },
}

MEAL_DATABASE = {
    "breakfast": {
        "low_cal": [
            {"name": "Greek Yogurt with Berries", "calories": 200, "protein": 15, "carbs": 25, "fat": 3, "ingredients": ["Greek yogurt", "Mixed berries", "Honey"], "time": "5 mins"},
            {"name": "Vegetable Omelette", "calories": 250, "protein": 18, "carbs": 5, "fat": 18, "ingredients": ["Eggs", "Spinach", "Tomatoes", "Onions"], "time": "10 mins"},
        ],
        "medium_cal": [
            {"name": "Oatmeal with Banana", "calories": 350, "protein": 12, "carbs": 60, "fat": 8, "ingredients": ["Oats", "Banana", "Almonds", "Honey"], "time": "10 mins"},
            {"name": "Avocado Toast with Eggs", "calories": 400, "protein": 18, "carbs": 30, "fat": 25, "ingredients": ["Whole wheat bread", "Avocado", "Eggs"], "time": "15 mins"},
        ],
        "high_cal": [
            {"name": "Protein Pancakes", "calories": 500, "protein": 30, "carbs": 55, "fat": 18, "ingredients": ["Protein powder", "Oats", "Eggs", "Banana"], "time": "20 mins"},
        ],
    },
    "lunch": {
        "low_cal": [
            {"name": "Grilled Chicken Salad", "calories": 350, "protein": 35, "carbs": 15, "fat": 18, "ingredients": ["Chicken breast", "Mixed greens", "Tomatoes", "Olive oil"], "time": "15 mins"},
        ],
        "medium_cal": [
            {"name": "Quinoa Buddha Bowl", "calories": 500, "protein": 20, "carbs": 60, "fat": 20, "ingredients": ["Quinoa", "Chickpeas", "Roasted vegetables", "Tahini"], "time": "25 mins"},
        ],
        "high_cal": [
            {"name": "Chicken Rice Bowl", "calories": 650, "protein": 40, "carbs": 70, "fat": 20, "ingredients": ["Brown rice", "Grilled chicken", "Vegetables", "Teriyaki sauce"], "time": "20 mins"},
        ],
    },
    "dinner": {
        "low_cal": [
            {"name": "Grilled Salmon with Vegetables", "calories": 400, "protein": 35, "carbs": 15, "fat": 22, "ingredients": ["Salmon fillet", "Broccoli", "Asparagus", "Lemon"], "time": "25 mins"},
        ],
        "medium_cal": [
            {"name": "Chicken Stir Fry", "calories": 550, "protein": 40, "carbs": 45, "fat": 20, "ingredients": ["Chicken", "Mixed vegetables", "Brown rice", "Soy sauce"], "time": "25 mins"},
        ],
        "high_cal": [
            {"name": "Lean Steak with Sweet Potato", "calories": 700, "protein": 50, "carbs": 50, "fat": 30, "ingredients": ["Sirloin steak", "Sweet potato", "Green beans"], "time": "30 mins"},
        ],
    },
    "snack": {
        "low_cal": [
            {"name": "Apple with Almond Butter", "calories": 150, "protein": 4, "carbs": 20, "fat": 8, "ingredients": ["Apple", "Almond butter"], "time": "2 mins"},
            {"name": "Greek Yogurt", "calories": 100, "protein": 17, "carbs": 6, "fat": 0.7, "ingredients": ["Greek yogurt"], "time": "1 min"},
        ],
    },
}

# =========================
# ROUTES
# =========================
@app.get("/")
def root():
    return {"status": "NutriLife API running", "version": "1.0.0"}

@app.get("/api/health")
def health_check():
    """Check API and database health"""
    health_status = {
        "status": "healthy",
        "api": "running",
        "version": "1.0.0",
        "database": "unknown",
        "openai": "unknown"
    }
    
    # Check database connection
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
        conn.close()
        health_status["database"] = "connected"
    except Exception as e:
        print(f"Health check - Database error: {e}")
        health_status["database"] = "disconnected"
        health_status["status"] = "degraded"
        health_status["database_error"] = str(e)
    
    # Check OpenAI API key
    if os.getenv("OPENROUTER_API_KEY"):
        health_status["openai"] = "configured"
    else:
        health_status["openai"] = "not_configured"
        health_status["status"] = "degraded"
    
    return health_status


@app.get("/api/db-test")
def db_test():
    """Test database connectivity"""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.fetchone()
        
        cur.execute("SHOW TABLES")
        tables = [row[0] for row in cur.fetchall()]
        
        cur.execute("SELECT COUNT(*) FROM users")
        user_count = cur.fetchone()[0]
        
        cur.close()
        conn.close()
        
        return {
            "status": "connected",
            "database": DB_CONFIG["database"],
            "tables": tables,
            "user_count": user_count
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

# =========================
# AUTH ROUTES
# =========================
# =========================
# AUTH ROUTES (FIXED)
# =========================

@app.post("/api/auth/register", response_model=AuthResponse)
def register(data: RegisterRequest, request: Request):
    """Register a new user account"""
    conn = None
    cur = None

    try:
        print(f"[v0] Registration attempt for: {data.email}")

        # Validate password
        is_valid, message = validate_password_strength(data.password)
        if not is_valid:
            raise HTTPException(status_code=400, detail=message)

        conn = get_db()
        cur = conn.cursor()

        # Check if email exists
        cur.execute("SELECT id FROM users WHERE email = %s", (data.email,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="Email already registered")

        # Insert user
        cur.execute("""
            INSERT INTO users (email, password_hash, name, gender, age, height, weight)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            data.email,
            hash_password(data.password),
            data.name,
            data.gender,
            data.age,
            data.height,
            data.weight
        ))

        user_id = cur.lastrowid

        # Create session
        token = generate_token()
        cur.execute("""
            INSERT INTO sessions (user_id, token_hash, expires_at, ip_address, user_agent)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            user_id,
            hash_token(token),
            datetime.now() + timedelta(days=7),
            request.client.host if request.client else None,
            request.headers.get("user-agent", "")[:500]
        ))

        conn.commit()

        return AuthResponse(
            success=True,
            message="Registration successful",
            token=token,
            user={"id": user_id, "email": data.email, "name": data.name}
        )

    except HTTPException:
        if conn:
            conn.rollback()
        raise

    except mysql.connector.Error as e:
        if conn:
            conn.rollback()
        print(f"Registration DB error: {e}")
        raise HTTPException(status_code=500, detail="Database error. Please try again.")

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail="Registration failed")

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@app.post("/api/auth/login", response_model=AuthResponse)
def login(data: LoginRequest, request: Request):
    conn = None
    cur = None

    try:
        email = data.email.lower().strip()
        conn = get_db()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT id, email, name, password_hash, is_active,
                   failed_login_attempts, locked_until
            FROM users WHERE email = %s
        """, (email,))
        user = cur.fetchone()

        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        if user["locked_until"] and user["locked_until"] > datetime.now():
            raise HTTPException(status_code=423, detail="Account locked. Try again later.")

        if not user["is_active"]:
            raise HTTPException(status_code=403, detail="Account disabled")

        if not verify_password(data.password, user["password_hash"]):
            failed = user["failed_login_attempts"] + 1
            locked_until = datetime.now() + timedelta(minutes=15) if failed >= 5 else None

            cur.execute("""
                UPDATE users SET failed_login_attempts=%s, locked_until=%s WHERE id=%s
            """, (failed, locked_until, user["id"]))
            conn.commit()

            raise HTTPException(status_code=401, detail="Invalid email or password")

        # Reset failed attempts
        cur.execute("""
            UPDATE users SET failed_login_attempts=0, locked_until=NULL WHERE id=%s
        """, (user["id"],))

        token = generate_token()
        cur.execute("""
            INSERT INTO sessions (user_id, token_hash, expires_at, ip_address, user_agent)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            user["id"],
            hash_token(token),
            datetime.now() + timedelta(days=7),
            request.client.host if request.client else None,
            request.headers.get("user-agent", "")[:500]
        ))

        conn.commit()

        return AuthResponse(
            success=True,
            message="Login successful",
            token=token,
            user={"id": user["id"], "email": user["email"], "name": user["name"]}
        )

    except HTTPException:
        if conn:
            conn.rollback()
        raise

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Login failed")

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@app.post("/api/auth/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return {"success": True, "message": "Already logged out"}

    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "UPDATE sessions SET is_valid=FALSE WHERE token_hash=%s",
            (hash_token(credentials.credentials),)
        )
        conn.commit()
    except Exception as e:
        print(f"Logout error: {e}")
    finally:
        try:
            cur.close()
            conn.close()
        except:
            pass

    return {"success": True, "message": "Logged out successfully"}


@app.get("/api/auth/me")
def get_me(user=Depends(require_auth)):
    return {"success": True, "user": user}


@app.put("/api/auth/profile")
def update_profile(data: UpdateProfileRequest, user=Depends(require_auth)):
    updates, values = [], []

    if data.name is not None:
        updates.append("name=%s")
        values.append(sanitize_input(data.name, 100))
    if data.gender is not None:
        updates.append("gender=%s")
        values.append(sanitize_input(data.gender, 20))
    if data.age is not None:
        updates.append("age=%s")
        values.append(data.age)
    if data.height is not None:
        updates.append("height=%s")
        values.append(data.height)
    if data.weight is not None:
        updates.append("weight=%s")
        values.append(data.weight)
    if data.activity_level is not None:
        updates.append("activity_level=%s")
        values.append(sanitize_input(data.activity_level, 50))
    if data.metabolism_type is not None:
        updates.append("metabolism_type=%s")
        values.append(sanitize_input(data.metabolism_type, 50))
    if data.goal is not None:
        updates.append("goal=%s")
        values.append(sanitize_input(data.goal, 50))

    if not updates:
        return {"success": True, "message": "No changes provided"}

    values.append(user["id"])

    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id=%s", values)
        conn.commit()
        return {"success": True, "message": "Profile updated successfully"}
    except Exception as e:
        print(f"Profile update error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update profile")
    finally:
        cur.close()
        conn.close()


# =========================
# FOOD ANALYSIS ROUTES
# =========================
@app.post("/api/analyze-food", response_model=FoodAnalysisResponse)
def analyze_food(req: FoodAnalysisRequest):
    """Analyze food from description or image using OpenAI"""
    try:
        description = req.description or ""
        
        system_prompt = """You are a certified nutritionist. Analyze the food and provide accurate nutritional information.

Return ONLY valid JSON with this structure:
{
    "food_name": "Name of dish",
    "portion_size": "Estimated portion",
    "meal_category": "Breakfast/Lunch/Dinner/Snack",
    "items": [{"name": "Item", "portion": "size", "calories": 100}],
    "nutrition": {"calories": 250, "protein": 15.0, "carbs": 30.0, "fat": 8.0, "fiber": 5.0, "sugar": 8.0, "sodium": 400},
    "health_benefits": ["Benefit 1", "Benefit 2"],
    "warnings": ["Warning if any"],
    "healthier_alternatives": ["Alternative 1"]
}

Use USDA database standards for calorie estimates."""

        user_prompt = f"Analyze this food: {description if description else 'food in image'}"
        
        if req.image_base64:
            ai_response = ask_openai_with_image(system_prompt, user_prompt, req.image_base64)
        else:
            ai_response = ask_openai(system_prompt, user_prompt, max_tokens=1200)
        
        if ai_response:
            try:
                clean = ai_response.strip()
                if clean.startswith("```"):
                    clean = clean.split("```")[1]
                    if clean.startswith("json"):
                        clean = clean[4:]
                clean = clean.strip()
                
                data = json.loads(clean)
                
                return FoodAnalysisResponse(
                    success=True,
                    food_name=data.get("food_name", "Analyzed Food"),
                    portion_size=data.get("portion_size", "1 serving"),
                    nutrition=NutritionInfo(**data["nutrition"]),
                    items=[FoodItem(**item) for item in data.get("items", [])],
                    health_benefits=data.get("health_benefits", []),
                    warnings=data.get("warnings", []),
                    healthier_alternatives=data.get("healthier_alternatives", []),
                    meal_category=data.get("meal_category", "Meal")
                )
            except json.JSONDecodeError:
                pass
        
        # Fallback to database
        desc_lower = description.lower() if description else ""
        matched = "default"
        for key in FOOD_DATABASE.keys():
            if key in desc_lower:
                matched = key
                break
        
        nutrition = FOOD_DATABASE[matched]
        
        return FoodAnalysisResponse(
            success=True,
            food_name=matched.title() if matched != "default" else "Mixed Meal",
            portion_size="1 serving",
            nutrition=NutritionInfo(**nutrition),
            items=[FoodItem(name=matched.title(), portion="1 serving", calories=nutrition["calories"])],
            health_benefits=HEALTH_BENEFITS.get(matched, ["Provides essential nutrients"]),
            warnings=FOOD_WARNINGS.get(matched, []),
            healthier_alternatives=HEALTHIER_ALTERNATIVES.get(matched, []),
            meal_category="Meal"
        )
        
    except Exception as e:
        print(f"Food analysis error: {e}")
        raise HTTPException(status_code=500, detail="Food analysis failed")

@app.post("/api/upload-food-image")
async def upload_food_image(
    file: UploadFile = File(...),
    description: Optional[str] = Form(None)
):
    """Upload food image for analysis"""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid image type")
    
    data = await file.read()
    b64 = base64.b64encode(data).decode()
    
    return analyze_food(FoodAnalysisRequest(description=description, image_base64=b64))

# =========================
# HEALTH CHAT ROUTES
# =========================
@app.post("/api/health-chat", response_model=HealthChatResponse)
def health_chat(req: HealthChatRequest):
    """Health assistant chatbot"""
    try:
        print(f"[v0] Health chat request received: {req.message[:50]}...")
        
        system_prompt = """You are a helpful health assistant. Provide accurate health information.

For symptoms, include at the END of your response:
---SYMPTOM_DATA---
{"detected_symptoms": [], "severity": "low/medium/high", "possible_conditions": [], "remedies": [], "preventive_measures": [], "should_consult_doctor": false, "urgency": "low"}
---END_DATA---

Always recommend seeing a doctor for serious symptoms. Never diagnose - only suggest possibilities."""

        messages = [{"role": m.role, "content": m.content} for m in req.history[-10:]]
        messages.append({"role": "user", "content": req.message})
        
        print("[v0] Calling OpenAI...")
        ai_response = ask_openai_with_history(system_prompt, messages, max_tokens=1000)
        print(f"[v0] OpenAI response received: {ai_response[:100] if ai_response else 'None'}...")
        
        if ai_response:
            response_text = ai_response
            symptom_analysis = None
            
            if "---SYMPTOM_DATA---" in ai_response:
                parts = ai_response.split("---SYMPTOM_DATA---")
                response_text = parts[0].strip()
                
                try:
                    data_part = parts[1].split("---END_DATA---")[0].strip()
                    data = json.loads(data_part)
                    symptom_analysis = SymptomAnalysis(**data)
                except Exception as e:
                    print(f"[v0] Could not parse symptom data: {e}")
                    pass
            
            print("[v0] Returning successful response")
            return HealthChatResponse(success=True, response=response_text, symptom_analysis=symptom_analysis)
        
        # Fallback
        msg_lower = req.message.lower()
        for symptom, data in SYMPTOM_DATABASE.items():
            if symptom in msg_lower:
                return HealthChatResponse(
                    success=True,
                    response=f"I see you're experiencing {symptom}. Here are some suggestions: {', '.join(data['remedies'][:3])}",
                    symptom_analysis=SymptomAnalysis(
                        detected_symptoms=[symptom],
                        severity=data["severity"],
                        possible_conditions=data["conditions"],
                        remedies=data["remedies"],
                        preventive_measures=data["prevention"],
                        should_consult_doctor=data["severity"] != "low",
                        urgency=data["severity"]
                    )
                )
        
        return HealthChatResponse(
            success=True,
            response="Hello! I'm your health assistant. How can I help you today?",
            symptom_analysis=None
        )
        
    except Exception as e:
        print(f"[v0] Health chat error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Health chat failed: {str(e)}")

# =========================
# DIET PLAN ROUTES
# =========================
@app.post("/api/diet-plan", response_model=DietPlanResponse)
def generate_diet_plan(req: DietPlanRequest):
    """Generate personalized diet plan"""
    try:
        # Calculate BMI
        height_m = req.height / 100
        bmi = round(req.weight / (height_m ** 2), 1)
        
        if bmi < 18.5:
            category = "Underweight"
        elif bmi < 25:
            category = "Normal weight"
        elif bmi < 30:
            category = "Overweight"
        else:
            category = "Obese"
        
        min_healthy = round(18.5 * (height_m ** 2), 1)
        max_healthy = round(24.9 * (height_m ** 2), 1)
        
        # Calculate BMR
        if req.gender.lower() == "male":
            bmr = 10 * req.weight + 6.25 * req.height - 5 * req.age + 5
        else:
            bmr = 10 * req.weight + 6.25 * req.height - 5 * req.age - 161
        
        # Metabolism modifier
        meta_mod = {"fast": 1.1, "normal": 1.0, "slow": 0.9}.get(req.metabolism_type.lower(), 1.0)
        bmr *= meta_mod
        
        # Activity multiplier
        activity_mult = {
            "sedentary": 1.2, "light": 1.375, "moderate": 1.55,
            "active": 1.725, "very_active": 1.9
        }.get(req.activity_level.lower(), 1.55)
        
        tdee = bmr * activity_mult
        
        # Goal adjustment
        goal_adj = {
            "lose": -500, "lose_fast": -750, "maintain": 0,
            "gain": 300, "gain_muscle": 400
        }.get(req.goal.lower(), 0)
        
        target_cal = max(int(tdee + goal_adj), 1200 if req.gender.lower() == "female" else 1500)
        
        # Macros
        if req.goal.lower() in ["gain_muscle", "gain"]:
            p, c, f = 0.30, 0.45, 0.25
        elif req.goal.lower() in ["lose", "lose_fast"]:
            p, c, f = 0.35, 0.35, 0.30
        else:
            p, c, f = 0.25, 0.50, 0.25
        
        macros = {
            "protein": int(target_cal * p / 4),
            "carbs": int(target_cal * c / 4),
            "fat": int(target_cal * f / 9),
            "fiber": 25 if req.gender.lower() == "female" else 38
        }
        
        # Calorie split per meal (percentages of target_cal)
        cal_split = {
            "breakfast": 0.25,
            "morning_snack": 0.10,
            "lunch": 0.30,
            "afternoon_snack": 0.10,
            "dinner": 0.25,
        }
        prep_times = {
            "breakfast": "10 mins",
            "morning_snack": "5 mins",
            "lunch": "20 mins",
            "afternoon_snack": "5 mins",
            "dinner": "25 mins",
        }

        # ── AI-powered meal plan generation ──────────────────────────
        restrictions = ", ".join(req.dietary_restrictions) if req.dietary_restrictions else "none"

        # Map diet_type to clear instruction for the AI
        diet_type_map = {
            "veg":           "STRICT VEGETARIAN — no meat, no fish, no eggs. Use dairy (milk, paneer, curd, ghee) and plant proteins.",
            "non_veg":       "Non-vegetarian — include chicken, fish, eggs, and dairy as appropriate.",
            "vegan":         "STRICT VEGAN — absolutely no animal products (no meat, no fish, no eggs, no dairy, no honey). Use tofu, legumes, nuts, seeds, plant-based milk.",
            "jain":          "STRICT JAIN DIET — no meat, no fish, no eggs, no root vegetables (no onion, garlic, potato, carrot, beetroot, radish). Use dairy, grains, above-ground vegetables, fruits, and legumes only.",
            "indian_non_veg":"INDIAN NON-VEGETARIAN DIET — absolutely NO beef or beef products (no beef, no veal, no buffalo meat). Include chicken, mutton, fish, eggs, and dairy. Use Indian spices and cooking styles (curry, tandoor, biryani etc.).",
            "halal":         "HALAL / MUSLIM DIET — absolutely NO pork or pork products (no bacon, no ham, no lard, no gelatin from pork). Include halal chicken, halal beef/mutton, fish, eggs, and dairy. All meat must be halal. No alcohol in cooking.",
        }
        diet_instruction = diet_type_map.get(req.diet_type, diet_type_map["non_veg"])

        ai_system_prompt = (
            "You are a certified clinical dietitian and meal planner with expertise in Indian and global diets. "
            "You must return ONLY valid, minified JSON. "
            "No markdown, no explanations, no comments, no extra keys, no trailing commas. "
            "Follow the requested JSON schema exactly."
        )
        # Compact single-line example keeps prompt short; max 3 ingredients per meal prevents truncation
        # ── Fasting plan context ──────────────────────────────────────────────
        fasting_context = ""
        if req.fasting_plan and req.fasting_plan != "none":
            fasting_meta = FASTING_PLANS.get(req.fasting_plan, {})
            fast_h = fasting_meta.get("fast_hours", 0)
            eat_h  = fasting_meta.get("eat_hours", 24)
            fname  = fasting_meta.get("name", req.fasting_plan)
            if req.fasting_plan in ("5:2",):
                fasting_context = (
                    f"\nFASTING PROTOCOL: {fname} — the user fasts 2 days per week (500-600 kcal only on Mon & Thu) "
                    f"and eats normally the other 5 days. Reflect this in the meal plan accordingly.\n"
                )
            elif req.fasting_plan == "alternate":
                fasting_context = (
                    f"\nFASTING PROTOCOL: {fname} — the user alternates between fasting days (~500 kcal) "
                    f"and normal eating days. Adjust odd/even days accordingly.\n"
                )
            else:
                # Time-restricted eating: calculate eating window times
                # Assume eating window starts at 12:00 PM for 16:8, adjusted for others
                if fast_h >= 20:
                    eat_start = "2:00 PM"
                elif fast_h >= 18:
                    eat_start = "12:00 PM"
                elif fast_h >= 16:
                    eat_start = "12:00 PM"
                elif fast_h >= 14:
                    eat_start = "10:00 AM"
                else:
                    eat_start = "8:00 AM"
                fasting_context = (
                    f"\nFASTING PROTOCOL: {fname} ({fast_h}h fast / {eat_h}h eating window). "
                    f"All meals MUST fit within the {eat_h}-hour eating window starting at {eat_start}. "
                    f"Do NOT include breakfast outside this window. "
                    f"Adjust meal names and times to fit the eating window. "
                    f"If the eating window is very short (<=4h), consolidate to 1-2 meals + a snack only.\n"
                )

        ai_user_prompt = (
            f"Create a 7-day meal plan STRICTLY BASED ON BMI CATEGORY.\n\n"
            f"USER PROFILE:\n"
            f"Gender: {req.gender}\n"
           f"Age: {req.age}\n"
            f"Height: {req.height} cm\n"
           f"Weight: {req.weight} kg\n"
                   f"BMI: {bmi}\n"
           f"BMI CATEGORY: {category}\n"
            f"Goal: {req.goal}\n"
            f"Activity Level: {req.activity_level}\n"
            f"Metabolism Type: {req.metabolism_type}\n"
            f"Target Calories: {target_cal} kcal/day\n"
            f"Dietary Restrictions: {restrictions}\n\n"
           f"DIET TYPE (MANDATORY): {diet_instruction}\n"
            f"{fasting_context}\n\n"

            "BMI-BASED DIET RULES (STRICT – MUST FOLLOW):\n"
            "- If BMI CATEGORY is 'Underweight':\n"
            "  • Focus on calorie-dense but healthy foods\n"
            "  • Include complex carbs, healthy fats, and sufficient protein\n"
            "  • Do NOT include low-calorie or restrictive meals\n\n"

            "- If BMI CATEGORY is 'Normal weight':\n"
            "  • Provide balanced meals with carbs, protein, and fats\n"
           "  • Maintain weight stability and nutrition quality\n\n"

            "- If BMI CATEGORY is 'Overweight' or 'Obese':\n"
            "  • PRIORITIZE high-protein, high-fiber meals\n"
            "  • LIMIT refined carbs, sugars, fried foods\n"
            "  • Emphasize vegetables, lean protein, and low-GI carbs\n"
            "  • Avoid calorie-dense or indulgent meals\n\n"
            "BMI-BASED VARIATION RULE:"
            "- Underweight meals should sound calorie-dense and hearty"
            "- Normal BMI meals should sound balanced and neutral"
            "- Overweight/Obese meals should sound light, grilled, steamed, or bowl-based"
            "- Dish names MUST reflect this difference in wording"

            "MEAL STRUCTURE RULES:\n"
            "- Each meal MUST have:\n"
            "  • ONE clear MAIN DISH name\n"
            "  • EXACTLY TWO supporting ingredients\n"
            "- Ingredients must naturally complement the dish\n"
            "- Snacks must follow the same structure\n"
           "- Keep names short and realistic\n"
            "- No calories, macros, or cooking instructions in names\n\n"

            "OUTPUT FORMAT (STRICT JSON ONLY):\n"
           '{"days":[{"day":"Monday",'
            '"breakfast":{"name":"MAIN DISH","ingredients":["item1","item2"]},'
            '"morning_snack":{"name":"MAIN DISH","ingredients":["item1","item2"]},'
            '"lunch":{"name":"MAIN DISH","ingredients":["item1","item2"]},'
            '"afternoon_snack":{"name":"MAIN DISH","ingredients":["item1","item2"]},'
            '"dinner":{"name":"MAIN DISH","ingredients":["item1","item2"]}'
            '}],'
            '"tips":["tip1","tip2","tip3","tip4","tip5","tip6"]}\n\n'

            "VALIDATION RULES:\n"
            "- Exactly 7 days (Monday–Sunday)\n"
            "- Exactly 2 ingredients per meal\n"
            "- BMI rules must override goal if conflicts arise\n"
            "- Output must be valid JSON only"
        )       

        weekly_plan = []
        tips = [
            "Stay hydrated with 8-10 glasses of water daily",
            "Get 7-9 hours of sleep for optimal metabolism",
            "Eat slowly to improve digestion and satiety",
            "Include protein in every meal",
            "Meal prep on weekends to stay consistent",
            "Track your progress weekly, not daily",
        ]

        ai_raw = ask_openai(ai_system_prompt, ai_user_prompt, max_tokens=1500, temperature=0.7)

        ai_plan = None
        if ai_raw and not ai_raw.startswith("Error:"):
            try:
                clean = ai_raw.strip()
                if clean.startswith("```"):
                    clean = clean.split("```")[1]
                    if clean.startswith("json"):
                        clean = clean[4:]
                clean = clean.strip()
                ai_plan = json.loads(clean)
            except Exception as parse_err:
                print(f"Diet plan AI JSON parse error: {parse_err}")
                ai_plan = None

        if ai_plan and "days" in ai_plan and len(ai_plan["days"]) == 7:
            # Use AI-generated meals; distribute calories & macros mathematically
            if "tips" in ai_plan and ai_plan["tips"]:
                tips = ai_plan["tips"]

            for day_data in ai_plan["days"]:
                def build_meal(meal_key: str, data: dict) -> Meal:
                    meal_cal = int(target_cal * cal_split[meal_key])
                    meal_p = round(macros["protein"] * cal_split[meal_key], 1)
                    meal_c = round(macros["carbs"]   * cal_split[meal_key], 1)
                    meal_f = round(macros["fat"]     * cal_split[meal_key], 1)
                    return Meal(
                        name=data.get("name", meal_key.replace("_", " ").title()),
                        calories=meal_cal,
                        protein=meal_p,
                        carbs=meal_c,
                        fat=meal_f,
                        ingredients=data.get("ingredients", []),
                        preparation_time=prep_times[meal_key],
                    )

                b  = build_meal("breakfast",       day_data.get("breakfast",       {}))
                ms = build_meal("morning_snack",   day_data.get("morning_snack",   {}))
                lu = build_meal("lunch",           day_data.get("lunch",           {}))
                as_ = build_meal("afternoon_snack", day_data.get("afternoon_snack", {}))
                di = build_meal("dinner",          day_data.get("dinner",          {}))

                weekly_plan.append(DayPlan(
                    day=day_data["day"],
                    breakfast=b,
                    morning_snack=ms,
                    lunch=lu,
                    afternoon_snack=as_,
                    dinner=di,
                    total_calories=target_cal,
                ))
        else:
            # ── Fallback: MEAL_DATABASE ───────────────────────────────
            print("Diet plan AI unavailable or returned bad data — falling back to MEAL_DATABASE")
            tier = "low_cal" if target_cal < 1600 else ("medium_cal" if target_cal < 2200 else "high_cal")
            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

            for i, day in enumerate(days):
                b_db = MEAL_DATABASE["breakfast"].get(tier, MEAL_DATABASE["breakfast"]["medium_cal"])[i % len(MEAL_DATABASE["breakfast"].get(tier, MEAL_DATABASE["breakfast"]["medium_cal"]))]
                l_db = MEAL_DATABASE["lunch"].get(tier, MEAL_DATABASE["lunch"]["medium_cal"])[0]
                d_db = MEAL_DATABASE["dinner"].get(tier, MEAL_DATABASE["dinner"]["medium_cal"])[0]
                s_db = MEAL_DATABASE["snack"]["low_cal"]

                weekly_plan.append(DayPlan(
                    day=day,
                    breakfast=Meal(**{**b_db, "preparation_time": b_db["time"]}),
                    morning_snack=Meal(**{**s_db[0], "preparation_time": s_db[0]["time"]}),
                    lunch=Meal(**{**l_db, "preparation_time": l_db["time"]}),
                    afternoon_snack=Meal(**{**s_db[1 % len(s_db)], "preparation_time": s_db[1 % len(s_db)]["time"]}),
                    dinner=Meal(**{**d_db, "preparation_time": d_db["time"]}),
                    total_calories=b_db["calories"] + l_db["calories"] + d_db["calories"] + s_db[0]["calories"] + s_db[1 % len(s_db)]["calories"],
                ))
        
        return DietPlanResponse(
            success=True,
            bmi_result=BMIResult(bmi=bmi, category=category, healthy_weight_range=f"{min_healthy} - {max_healthy} kg"),
            bmr=round(bmr),
            tdee=round(tdee),
            target_calories=target_cal,
            macro_targets=macros,
            weekly_plan=weekly_plan,
            tips=tips
        )
        
    except Exception as e:
        print(f"Diet plan error: {e}")
        raise HTTPException(status_code=500, detail="Diet plan generation failed")

# =========================
# MEAL LOGGING ROUTES
# =========================
@app.post("/api/meals/log")
def log_meal(
    food_name: str,
    calories: int,
    protein: float = 0,
    carbs: float = 0,
    fat: float = 0,
    meal_type: str = "meal",
    notes: str = None,
    user=Depends(require_auth)
):
    """Log a meal"""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO meal_logs (user_id, food_name, calories, protein, carbs, fat, meal_type, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (user["id"], sanitize_input(food_name), calories, protein, carbs, fat, meal_type, notes))
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "message": "Meal logged"}
    except Exception as e:
        print(f"Meal log error: {e}")
        raise HTTPException(status_code=500, detail="Failed to log meal")

@app.get("/api/meals/history")
def get_meal_history(days: int = 7, user=Depends(require_auth)):
    """Get meal history"""
    try:
        conn = get_db()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT * FROM meal_logs
            WHERE user_id = %s AND logged_at >= DATE_SUB(NOW(), INTERVAL %s DAY)
            ORDER BY logged_at DESC
        """, (user["id"], days))
        meals = cur.fetchall()
        cur.close()
        conn.close()
        return {"success": True, "meals": meals}
    except Exception as e:
        print(f"Meal history error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get meal history")

@app.delete("/api/meals/{meal_id}")
def delete_meal(meal_id: int, user=Depends(require_auth)):
    """Delete a logged meal"""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM meal_logs WHERE id = %s AND user_id = %s",
            (meal_id, user["id"])
        )
        affected = cur.rowcount
        conn.commit()
        cur.close()
        conn.close()
        if affected == 0:
            raise HTTPException(status_code=404, detail="Meal not found")
        return {"success": True, "message": "Meal deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to delete meal")


@app.get("/api/meals/today")
def get_todays_meals(user=Depends(require_auth)):
    """Get all meals logged today"""
    try:
        conn = get_db()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT id, food_name, calories, protein, carbs, fat, meal_type, notes, logged_at
            FROM meal_logs
            WHERE user_id = %s AND DATE(logged_at) = CURDATE()
            ORDER BY logged_at DESC
        """, (user["id"],))
        meals = cur.fetchall()
        cur.close()
        conn.close()
        # Convert datetime to string for JSON
        for m in meals:
            if m.get("logged_at"):
                m["logged_at"] = m["logged_at"].isoformat()
        total_cal = sum(m["calories"] or 0 for m in meals)
        return {"success": True, "meals": meals, "total_calories": total_cal}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to get today's meals")


# =========================
# DASHBOARD STATS ROUTES
# =========================
@app.get("/api/dashboard/stats")
def get_dashboard_stats(user=Depends(require_auth)):
    """Get comprehensive dashboard statistics for the user"""
    try:
        conn = get_db()
        cur = conn.cursor(dictionary=True)
        
        # Get today's date
        today = datetime.now().date()
        
        # Get today's calorie intake
        cur.execute("""
            SELECT COALESCE(SUM(calories), 0) as total_calories,
                   COALESCE(SUM(protein), 0) as total_protein,
                   COALESCE(SUM(carbs), 0) as total_carbs,
                   COALESCE(SUM(fat), 0) as total_fat
            FROM meal_logs
            WHERE user_id = %s AND DATE(logged_at) = %s
        """, (user["id"], today))
        today_nutrition = cur.fetchone()
        
        # Get yesterday's calories for comparison
        yesterday = today - timedelta(days=1)
        cur.execute("""
            SELECT COALESCE(SUM(calories), 0) as total_calories
            FROM meal_logs
            WHERE user_id = %s AND DATE(logged_at) = %s
        """, (user["id"], yesterday))
        yesterday_nutrition = cur.fetchone()
        
        # Calculate calorie trend
        calorie_trend = 0
        if yesterday_nutrition['total_calories'] > 0:
            calorie_trend = int(((today_nutrition['total_calories'] - yesterday_nutrition['total_calories']) 
                               / yesterday_nutrition['total_calories']) * 100)
        
        # Get water intake for today
        cur.execute("""
            SELECT COALESCE(SUM(glasses), 0) as total_glasses
            FROM water_logs
            WHERE user_id = %s AND log_date = %s
        """, (user["id"], today))
        water_data = cur.fetchone()
        
        # Get weekly stats (last 7 days)
        cur.execute("""
            SELECT DATE(logged_at) as date, 
                   COALESCE(SUM(calories), 0) as calories
            FROM meal_logs
            WHERE user_id = %s 
              AND logged_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY DATE(logged_at)
            ORDER BY DATE(logged_at)
        """, (user["id"],))
        weekly_calories = cur.fetchall()
        
        # Get average weekly calories
        avg_weekly_calories = 0
        if weekly_calories:
            avg_weekly_calories = int(sum([d['calories'] for d in weekly_calories]) / len(weekly_calories))
        
        # Get recent weight (if tracked)
        cur.execute("""
            SELECT weight FROM daily_stats
            WHERE user_id = %s AND weight IS NOT NULL
            ORDER BY stat_date DESC
            LIMIT 2
        """, (user["id"],))
        weight_records = cur.fetchall()
        
        weight_change = None
        if len(weight_records) >= 2:
            weight_change = round(weight_records[0]['weight'] - weight_records[1]['weight'], 1)
        
        # Get user's target calories (from profile or calculate BMR/TDEE)
        target_calories = 2000  # Default
        if user.get('weight') and user.get('height') and user.get('age'):
            # Calculate BMR
            if user.get('gender', '').lower() == 'male':
                bmr = 10 * user['weight'] + 6.25 * user['height'] - 5 * user['age'] + 5
            else:
                bmr = 10 * user['weight'] + 6.25 * user['height'] - 5 * user['age'] - 161
            
            # Apply activity multiplier
            activity_mult = {'sedentary': 1.2, 'light': 1.375, 'moderate': 1.55, 
                           'active': 1.725, 'very_active': 1.9}.get(user.get('activity_level', '').lower(), 1.55)
            target_calories = int(bmr * activity_mult)
        
        # Calculate daily goal percentage
        daily_goal_percentage = min(int((today_nutrition['total_calories'] / target_calories) * 100), 100) if target_calories > 0 else 0
        
        # Get recent meals
        cur.execute("""
            SELECT food_name, calories, meal_type, logged_at
            FROM meal_logs
            WHERE user_id = %s
            ORDER BY logged_at DESC
            LIMIT 5
        """, (user["id"],))
        recent_meals = cur.fetchall()
        
        cur.close()
        conn.close()
        
        return {
            "success": True,
            "stats": {
                "today_calories": int(today_nutrition['total_calories']),
                "target_calories": target_calories,
                "calorie_trend": calorie_trend,
                "daily_goal_percentage": daily_goal_percentage,
                "water_glasses": int(water_data['total_glasses']),
                "target_water": 8,
                "weight_change": weight_change,
                "avg_weekly_calories": avg_weekly_calories,
                "weekly_activity": [int(d['calories']) for d in weekly_calories],
                "macros": {
                    "protein": round(today_nutrition['total_protein'], 1),
                    "carbs": round(today_nutrition['total_carbs'], 1),
                    "fat": round(today_nutrition['total_fat'], 1)
                },
                "recent_meals": recent_meals
            }
        }
        
    except Exception as e:
        print(f"Dashboard stats error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to get dashboard stats: {str(e)}")

# =========================
# WATER TRACKING ROUTES
# =========================
@app.post("/api/water/log")
def log_water(glasses: int = 1, user=Depends(require_auth)):
    """Log water intake"""
    try:
        conn = get_db()
        cur = conn.cursor()
        today = datetime.now().date()
        
        # Insert water log for today (same logic)
        cur.execute("""
            INSERT INTO water_logs (user_id, glasses, log_date)
            VALUES (%s, %s, %s)
        """, (user["id"], glasses, today))
        
        conn.commit()
        
        # Get total for today
        cur.execute("""
            SELECT COALESCE(SUM(glasses), 0) as total
            FROM water_logs
            WHERE user_id = %s AND log_date = %s
        """, (user["id"], today))
        
        result = cur.fetchone()

        # ✅ HARD FIX (no logic change)
        total_today = 0
        if result is not None and result[0] is not None:
            total_today = int(result[0])
        else:
            total_today = 0
        
        cur.close()
        conn.close()
        
        return {
            "success": True, 
            "message": "Water logged successfully",
            "total_today": total_today  # ALWAYS integer now
        }

    except Exception as e:
        print(f"Water log error: {e}")
        raise HTTPException(status_code=500, detail="Failed to log water intake")


@app.get("/api/water/today")
def get_water_today(user=Depends(require_auth)):
    """Get today's water intake"""
    try:
        conn = get_db()
        cur = conn.cursor()
        today = datetime.now().date()
        
        cur.execute("""
            SELECT COALESCE(SUM(glasses), 0) as total
            FROM water_logs
            WHERE user_id = %s AND log_date = %s
        """, (user["id"], today))
        
        result = cur.fetchone()

        # ✅ HARD FIX (no logic change)
        glasses_today = 0
        if result is not None and result[0] is not None:
            glasses_today = int(result[0])
        else:
            glasses_today = 0
        
        cur.close()
        conn.close()
        
        return {
            "success": True,
            "glasses": glasses_today,  # ALWAYS integer
            "target": 8
        }

    except Exception as e:
        print(f"Water fetch error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get water intake")

# =========================
# ENHANCED FOOD ANALYSIS WITH LOGGING
# =========================
@app.post("/api/analyze-food-and-log")
async def analyze_and_log_food(
    request: Request,
    user=Depends(require_auth)
):
    """Analyze food from image/description and automatically log it"""
    try:
        body = await request.json()
        description = body.get("description", "")
        image_base64 = body.get("image_base64")
        
        # First, analyze the food
        if not image_base64 and not description:
            raise HTTPException(status_code=400, detail="Either image or description required")
        
        # Use existing analyze endpoint logic
        if image_base64:
            system_prompt = """You are a nutrition expert. Analyze food images accurately.
Return a detailed JSON with this EXACT structure (no extra text):
{
  "items": [{"name": "food name", "portion": "serving size", "calories": number}],
  "nutrition": {"calories": total, "protein": grams, "carbs": grams, "fat": grams, "fiber": grams},
  "health_benefits": ["benefit1", "benefit2"],
  "warnings": ["warning1"],
  "healthier_alternatives": ["alternative1"]
}"""
            
            user_prompt = f"Analyze this food image. Description: {description if description else 'analyze what you see'}"
            response_text = ask_openai_with_image(system_prompt, user_prompt, image_base64, max_tokens=1500)
        else:
            system_prompt = """You are a nutrition expert. Provide nutrition data in JSON format only.
Return this EXACT structure (no extra text):
{
  "items": [{"name": "food name", "portion": "serving size", "calories": number}],
  "nutrition": {"calories": total, "protein": grams, "carbs": grams, "fat": grams, "fiber": grams},
  "health_benefits": ["benefit1"],
  "warnings": ["warning1"],
  "healthier_alternatives": ["alternative1"]
}"""
            response_text = ask_openai(system_prompt, f"Analyze: {description}", max_tokens=1000)
        
        if not response_text:
            raise HTTPException(status_code=500, detail="AI analysis failed")
        
        # Parse JSON response
        try:
            # Clean response
            response_text = response_text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            data = json.loads(response_text)
        except json.JSONDecodeError as e:
            print(f"JSON parse error: {e}")
            print(f"Response text: {response_text}")
            raise HTTPException(status_code=500, detail="Failed to parse nutrition data")
        
        # Log to database
        conn = get_db()
        cur = conn.cursor()
        
        # Log to food_analysis_history
        cur.execute("""
            INSERT INTO food_analysis_history 
            (user_id, food_items, total_calories, total_protein, total_carbs, total_fat, total_fiber)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            user["id"],
            json.dumps(data.get("items", [])),
            data.get("nutrition", {}).get("calories", 0),
            data.get("nutrition", {}).get("protein", 0),
            data.get("nutrition", {}).get("carbs", 0),
            data.get("nutrition", {}).get("fat", 0),
            data.get("nutrition", {}).get("fiber", 0)
        ))
        
        # Log each food item to meal_logs
        for item in data.get("items", []):
            cur.execute("""
                INSERT INTO meal_logs (user_id, food_name, calories, protein, carbs, fat, meal_type)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                user["id"],
                item.get("name", "Unknown"),
                item.get("calories", 0),
                data.get("nutrition", {}).get("protein", 0),
                data.get("nutrition", {}).get("carbs", 0),
                data.get("nutrition", {}).get("fat", 0),
                "analyzed"
            ))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            "success": True,
            **data,
            "logged": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Food analysis and logging error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Food analysis failed: {str(e)}")

# =========================
# PROFILE UPDATE WITH FULL DATA
# =========================
@app.get("/api/profile")
def get_profile(user=Depends(require_auth)):
    """Get full user profile"""
    try:
        conn = get_db()
        cur = conn.cursor(dictionary=True)
        
        cur.execute("""
            SELECT id, email, name, gender, age, height, weight, 
                   activity_level, metabolism_type, goal, created_at
            FROM users
            WHERE id = %s
        """, (user["id"],))
        
        profile = cur.fetchone()
        cur.close()
        conn.close()
        
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        return {
            "success": True,
            "profile": profile
        }
        
    except Exception as e:
        print(f"Profile fetch error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch profile")

@app.put("/api/profile")
async def update_profile(request: Request, user=Depends(require_auth)):
    """Update user profile"""
    try:
        body = await request.json()
        
        conn = get_db()
        cur = conn.cursor()
        
        # Build dynamic update query
        update_fields = []
        values = []
        
        allowed_fields = ['name', 'gender', 'age', 'height', 'weight', 'activity_level', 'metabolism_type', 'goal']
        
        for field in allowed_fields:
            if field in body and body[field] is not None:
                update_fields.append(f"{field} = %s")
                values.append(body[field])
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        values.append(user["id"])
        
        query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = %s"
        cur.execute(query, values)
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            "success": True,
            "message": "Profile updated successfully"
        }
        
    except Exception as e:
        print(f"Profile update error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update profile")


# =========================
# WATER INTAKE ENDPOINTS
# =========================

class WaterAdjustRequest(BaseModel):
    adjustment: int  # +1 or -1

@app.post("/api/water/adjust")
def adjust_water_intake(
    request: WaterAdjustRequest,
    user=Depends(require_auth)
):
    """Atomically adjust water intake for today"""
    from datetime import date as date_module
    today = date_module.today()
    
    conn = get_db()
    cur = conn.cursor(dictionary=True)
    
    try:
        # Check if water_intake table exists, create if not
        cur.execute("""
            CREATE TABLE IF NOT EXISTS water_intake (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                logged_date DATE NOT NULL,
                glasses_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY user_date (user_id, logged_date),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        
        # Get or create today's record
        cur.execute("""
            INSERT INTO water_intake (user_id, logged_date, glasses_count)
            VALUES (%s, %s, 0)
            ON DUPLICATE KEY UPDATE glasses_count = glasses_count
        """, (user["id"], today))
        
        # Atomic update with validation (prevent negative)
        cur.execute("""
            UPDATE water_intake
            SET glasses_count = GREATEST(0, glasses_count + %s),
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = %s AND logged_date = %s
        """, (request.adjustment, user["id"], today))
        
        # Fetch updated value
        cur.execute("""
            SELECT glasses_count
            FROM water_intake
            WHERE user_id = %s AND logged_date = %s
        """, (user["id"], today))
        
        result = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            "success": True,
            "current": result['glasses_count'] if result else 0,
            "target": 8,
            "date": today.isoformat()
        }
        
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# DIET PLAN ENDPOINTS
# =========================

@app.post("/api/diet-plan/save")
def save_diet_plan(
    plan_data: dict,
    user=Depends(require_auth)
):
    """Save generated diet plan for user"""
    from datetime import date as date_module, timedelta as timedelta_module
    
    conn = get_db()
    cur = conn.cursor()
    
    try:
        # Check if diet_plans table exists, create if not
        cur.execute("""
            CREATE TABLE IF NOT EXISTS diet_plans (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                plan_name VARCHAR(255) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                target_calories INT NOT NULL,
                target_protein DECIMAL(10,2) DEFAULT 0,
                target_carbs DECIMAL(10,2) DEFAULT 0,
                target_fat DECIMAL(10,2) DEFAULT 0,
                weekly_plan JSON,
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        
        # Deactivate old plans
        cur.execute("""
            UPDATE diet_plans 
            SET is_active = 0
            WHERE user_id = %s
        """, (user["id"],))
        
        # Insert new plan
        today = date_module.today()
        cur.execute("""
            INSERT INTO diet_plans (
                user_id, plan_name, start_date, end_date,
                target_calories, target_protein, target_carbs, target_fat,
                weekly_plan, is_active
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 1)
        """, (
            user["id"],
            f"Diet Plan - {today.isoformat()}",
            today,
            today + timedelta_module(days=7),
            plan_data.get('target_calories', 2000),
            plan_data.get('macros', {}).get('protein', 0),
            plan_data.get('macros', {}).get('carbs', 0),
            plan_data.get('macros', {}).get('fat', 0),
            json.dumps(plan_data.get('weekly_plan', []))
        ))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {"success": True, "message": "Diet plan saved successfully"}
        
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/diet-plan/next-meal")
def get_next_meal(user=Depends(require_auth)):
    """Get the next meal based on current time and diet plan"""
    from datetime import datetime as datetime_module, time as time_module
    
    now = datetime_module.now()
    current_time = now.time()
    current_day = now.strftime("%A")
    
    conn = get_db()
    cur = conn.cursor(dictionary=True)
    
    try:
        # Get active diet plan
        cur.execute("""
            SELECT * FROM diet_plans
            WHERE user_id = %s 
            AND is_active = 1
            AND start_date <= CURDATE()
            AND end_date >= CURDATE()
            ORDER BY created_at DESC
            LIMIT 1
        """, (user["id"],))
        
        plan = cur.fetchone()
        cur.close()
        conn.close()
        
        if not plan:
            return {"success": False, "message": "No active diet plan"}
        
        weekly_plan = json.loads(plan['weekly_plan'])
        
        # Find today's plan
        today_plan = None
        for day_data in weekly_plan:
            if day_data['day'] == current_day:
                today_plan = day_data
                break
        
        if not today_plan:
            return {"success": False, "message": "No plan for today"}
        
        # Define meal times
        meal_times = {
            "breakfast": time_module(7, 0),
            "morning_snack": time_module(10, 0),
            "lunch": time_module(12, 30),
            "afternoon_snack": time_module(15, 30),
            "dinner": time_module(19, 0)
        }
        
        # Find next meal
        next_meal = None
        for meal_type, meal_time in meal_times.items():
            if current_time < meal_time:
                for meal in today_plan.get('meals', []):
                    if meal['meal'].lower().replace(' ', '_') == meal_type:
                        next_meal = {
                            "type": meal_type,
                            "time": meal_time.strftime("%I:%M %p"),
                            "foods": meal['foods'],
                            "calories": meal['calories'],
                            "protein": meal['protein'],
                            "carbs": meal['carbs'],
                            "fat": meal['fat']
                        }
                        break
                break
        
        if next_meal:
            return {"success": True, "next_meal": next_meal}
        else:
            return {"success": False, "message": "All meals completed for today"}
            
    except Exception as e:
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# GOOGLE OAUTH AUTHENTICATION ROUTES
# =========================

@app.post("/api/auth/google")
async def google_login(request: dict, req: Request):
    """Authenticate user with Google OAuth"""
    if not google_auth_service:
        raise HTTPException(status_code=503, detail="Google Auth service not available. Install google-auth package.")
    
    try:
        credential = request.get("credential")
        if not credential:
            raise HTTPException(status_code=400, detail="Google credential required")
        
        ip_address = req.client.host if req.client else None
        user_agent = req.headers.get("user-agent", "")
        
        token, user, is_new = google_auth_service.authenticate_with_google(
            credential=credential,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        return {
            "token": token,
            "user": user,
            "is_new_user": is_new
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Google auth error: {e}")
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")


# =========================
# SUBSCRIPTION MANAGEMENT ROUTES
# =========================

@app.get("/api/subscription/plans")
async def get_subscription_plans():
    """Return subscription plans as a pure array (FIXED for frontend .map())"""

    try:
        # If subscription service is NOT available → return default plans
        if not subscription_service:
            return [
                {
                    "id": 1,
                    "name": "3-Month Premium",
                    "duration_months": 3,
                    "base_price": 299,
                    "final_price": 299,
                    "discount_amount": 0,
                    "badge": None,
                    "features": [
                        "AI Food Analyzer",
                        "Diet Planner",
                        "Advanced Nutrition Analytics",
                        "Meal Tracking History"
                    ],
                    "savings_percentage": 0,
                    "monthly_equivalent": round(299 / 3)
                },
                {
                    "id": 2,
                    "name": "6-Month Premium",
                    "duration_months": 6,
                    "base_price": 598,
                    "final_price": 549,
                    "discount_amount": 598 - 549,
                    "badge": "Most Popular",
                    "features": [
                        "AI Food Analyzer",
                        "Diet Planner",
                        "Advanced Nutrition Analytics",
                        "Meal Tracking History",
                        "Priority Support"
                    ],
                    "savings_percentage": round(((598 - 549) / 598) * 100),
                    "monthly_equivalent": round(549 / 6)
                },
                {
                    "id": 3,
                    "name": "1-Year Premium",
                    "duration_months": 12,
                    "base_price": 1196,
                    "final_price": 849,
                    "discount_amount": 1196 - 849,
                    "badge": "Best Value",
                    "features": [
                        "AI Food Analyzer",
                        "Diet Planner",
                        "Advanced Nutrition Analytics",
                        "Meal Tracking History",
                        "Priority Support",
                        "Exclusive Updates"
                    ],
                    "savings_percentage": round(((1196 - 849) / 1196) * 100),
                    "monthly_equivalent": round(849 / 12)
                }
            ]

        # If subscription service exists → return real plans
        plans = subscription_service.get_all_plans()

        # 🔥 IMPORTANT FIX
        # Always return array, never {"plans": plans}
        return plans

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/subscription/my-subscription")
async def get_my_subscription(user: dict = Depends(require_auth)):
    """Get current user's active subscription"""
    if not subscription_service:
        raise HTTPException(status_code=503, detail="Subscription service not available")
    
    try:
        subscription = subscription_service.get_user_subscription(user['id'])
        
        if not subscription:
            raise HTTPException(status_code=404, detail="No active subscription found")
        
        return subscription
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/subscription/create")
async def create_subscription_route(request: dict, user: dict = Depends(require_auth)):
    """
    Create a Razorpay ORDER (one-time payment) for the selected plan.
    Works on ALL Razorpay accounts — no Subscriptions product needed.

    Returns order_id + amount for the frontend Razorpay checkout.
    """
    try:
        rzp_key = os.getenv("RAZORPAY_KEY_ID", "")
        rzp_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
        if not rzp_key or not rzp_secret:
            raise HTTPException(
                status_code=503,
                detail="Payment gateway not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to api/.env and restart the server."
            )

        plan_id = request.get("plan_id")
        if not plan_id:
            raise HTTPException(status_code=400, detail="plan_id is required")

        plans = await get_subscription_plans()
        plan = next((p for p in plans if p["id"] == plan_id), None)
        if not plan:
            raise HTTPException(status_code=404, detail="Subscription plan not found")

        amount_paise = int(plan["final_price"] * 100)

        # ── Create Razorpay Order (works on all accounts) ─────────────────────
        order = razorpay_client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "payment_capture": 1,
            "notes": {
                "user_id": str(user["id"]),
                "plan_id": str(plan_id),
                "plan_name": plan["name"],
                "duration_months": str(plan["duration_months"])
            }
        })

        # ── Persist pending transaction ───────────────────────────────────────
        conn = get_db()
        cur = conn.cursor()
        try:
            cur.execute("""
                INSERT INTO payment_transactions
                (user_id, plan_id, amount, currency, payment_status,
                 payment_method, transaction_id, gateway_response, created_at)
                VALUES (%s, %s, %s, 'INR', 'pending', 'razorpay_order', %s, %s, NOW())
            """, (
                user["id"], plan_id, plan["final_price"],
                order["id"],
                json.dumps({"razorpay_order_id": order["id"], "plan_id": plan_id})
            ))
            conn.commit()
        finally:
            cur.close()
            conn.close()

        return {
            "order_id": order["id"],
            "amount": amount_paise,
            "currency": "INR",
            "plan_id": plan_id,
            "plan_name": plan["name"],
            "key_id": rzp_key
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Subscription creation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")


@app.post("/api/subscription/create-payment")
async def create_payment_legacy(request: dict, user: dict = Depends(require_auth)):
    """Legacy alias → same as /api/subscription/create"""
    return await create_subscription_route(request, user)


'''@app.post("/api/subscription/activate-subscription")
async def activate_subscription_manual(
    transaction_id: str,
    user: dict = Depends(require_auth)
):
    """Activate subscription after payment (demo mode - no actual payment required)"""
    if not subscription_service:
        raise HTTPException(status_code=503, detail="Subscription service not available")
    
    try:
        subscription = subscription_service.activate_subscription(
            transaction_id=transaction_id,
            gateway_response={"status": "success", "mode": "demo"}
        )
        
        return {
            "success": True,
            "subscription": subscription,
            "message": "Subscription activated successfully!"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))'''
        
@app.post("/api/subscription/verify-payment")
async def verify_payment(data: dict, user: dict = Depends(require_auth)):
    """
    Verify Razorpay payment signature after checkout success.
    Activates the subscription for the user.

    Expected body:
        razorpay_payment_id  : "pay_XXXX"
        razorpay_subscription_id : "sub_XXXX"
        razorpay_signature   : "<hmac>"
        plan_id              : <int>
    """
    try:
        rzp_payment_id = data.get("razorpay_payment_id")
        rzp_sub_id = data.get("razorpay_subscription_id")
        rzp_signature = data.get("razorpay_signature")
        plan_id = data.get("plan_id")

        rzp_order_id = data.get("razorpay_order_id")

        if not all([rzp_payment_id, rzp_signature, rzp_order_id]):
            raise HTTPException(status_code=400, detail="Missing payment verification fields (need razorpay_payment_id, razorpay_order_id, razorpay_signature)")

        # ── Verify order payment signature ────────────────────────────────────
        # Signature = HMAC-SHA256(order_id + "|" + payment_id)
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": rzp_order_id,
            "razorpay_payment_id": rzp_payment_id,
            "razorpay_signature": rzp_signature
        })

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Payment signature verification failed")

    # ── Activate subscription in DB ──────────────────────────────────────────
    try:
        # Derive duration from plan
        plans = await get_subscription_plans()
        plan = next((p for p in plans if p["id"] == plan_id), None)
        duration_months = plan["duration_months"] if plan else 1

        start_date = datetime.now()
        end_date = start_date + timedelta(days=duration_months * 30)

        conn = get_db()
        cur = conn.cursor()
        try:
            # Update / create user_subscriptions row
            cur.execute("""
                INSERT INTO user_subscriptions
                (user_id, plan_id, status, start_date, end_date, created_at)
                VALUES (%s, %s, 'active', %s, %s, NOW())
                ON DUPLICATE KEY UPDATE
                    status='active', start_date=%s, end_date=%s, updated_at=NOW()
            """, (user["id"], plan_id, start_date, end_date, start_date, end_date))

            sub_id = cur.lastrowid

            # Mark payment_transactions completed
            cur.execute("""
                UPDATE payment_transactions
                SET payment_status='completed',
                    subscription_id=%s,
                    gateway_response=%s,
                    updated_at=NOW()
                WHERE transaction_id=%s
            """, (
                sub_id,
                json.dumps({"razorpay_payment_id": rzp_payment_id,
                            "razorpay_order_id": rzp_order_id}),
                rzp_order_id
            ))

            # Update users table with all required subscription fields
            cur.execute("""
                UPDATE users SET
                    is_premium = TRUE,
                    subscription_status = 'active',
                    razorpay_subscription_id = %s,
                    payment_id = %s,
                    subscription_start_date = %s,
                    subscription_end_date = %s,
                    subscription_expires_at = %s,
                    updated_at = NOW()
                WHERE id = %s
            """, (rzp_order_id, rzp_payment_id, start_date, end_date, end_date, user["id"]))

            conn.commit()
        finally:
            cur.close()
            conn.close()

        return {
            "success": True,
            "message": "Subscription activated successfully!",
            "subscription": {
                "status": "active",
                "plan_name": plan["name"] if plan else "Premium",
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days_remaining": duration_months * 30
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Subscription activation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to activate subscription: {str(e)}")


@app.get("/api/subscription/status")
async def get_subscription_status(user: dict = Depends(require_auth)):
    """Get user's subscription status"""
    if not subscription_middleware:
        return {
            "is_premium": False,
            "has_subscription": False,
            "blocked_features": [],
            "message": "Subscription service not available"
        }
    
    try:
        status = subscription_middleware.check_subscription_status(user['id'])
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/subscription/feature-access/{feature_name}")
async def check_feature_access(
    feature_name: str,
    user: dict = Depends(require_auth)
):
    """Check if user has access to a specific feature"""
    if not subscription_middleware:
        # Fallback: allow all features if middleware not available
        return {
            "feature_name": feature_name,
            "has_access": True,
            "requires_premium": False,
            "message": "Feature available"
        }
    
    try:
        access = subscription_middleware.check_feature_access(
            user_id=user['id'],
            feature_name=feature_name
        )
        
        return {
            "feature_name": feature_name,
            "has_access": access['has_access'],
            "requires_premium": access['requires_premium'],
            "message": access['message']
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# RAZORPAY WEBHOOK
# =========================

import hmac
import hashlib

@app.post("/api/webhook/razorpay")
async def razorpay_webhook(request: Request):
    """
    Razorpay webhook endpoint.
    Verifies the X-Razorpay-Signature header and processes events:
      - subscription.activated
      - subscription.charged
      - subscription.cancelled
      - payment.failed

    Set this URL in the Razorpay dashboard → Settings → Webhooks.
    Webhook secret must match RAZORPAY_WEBHOOK_SECRET env variable.
    """
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    if not webhook_secret:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    body_bytes = await request.body()
    received_sig = request.headers.get("X-Razorpay-Signature", "")

    # ── Verify webhook signature ─────────────────────────────────────────────
    expected_sig = hmac.new(
        webhook_secret.encode("utf-8"),
        body_bytes,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_sig, received_sig):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        payload = json.loads(body_bytes)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = payload.get("event", "")
    event_id = payload.get("event_id") or payload.get("id") or secrets.token_urlsafe(8)

    # ── Idempotency: skip already-processed events ───────────────────────────
    try:
        conn = get_db()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT id FROM razorpay_webhook_events WHERE event_id = %s",
            (event_id,)
        )
        already_done = cur.fetchone()
        if already_done:
            cur.close()
            conn.close()
            return {"status": "already_processed"}

        # Log the event
        cur.execute(
            """INSERT INTO razorpay_webhook_events
               (event_id, event_type, payload, processed, created_at)
               VALUES (%s, %s, %s, FALSE, NOW())""",
            (event_id, event_type, json.dumps(payload))
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as db_err:
        print(f"Webhook DB log error: {db_err}")

    # ── Route events ─────────────────────────────────────────────────────────
    try:
        if event_type in ("subscription.activated", "subscription.charged"):
            await _webhook_activate_subscription(payload)

        elif event_type == "subscription.cancelled":
            await _webhook_cancel_subscription(payload)

        elif event_type == "payment.failed":
            await _webhook_payment_failed(payload)

        # Mark processed
        try:
            conn = get_db()
            cur = conn.cursor()
            cur.execute(
                "UPDATE razorpay_webhook_events SET processed=TRUE WHERE event_id=%s",
                (event_id,)
            )
            conn.commit()
            cur.close()
            conn.close()
        except Exception:
            pass

    except Exception as e:
        print(f"Webhook processing error for {event_type}: {e}")

    return {"status": "ok"}


async def _webhook_activate_subscription(payload: dict):
    """Handle subscription.activated / subscription.charged."""
    sub_data = payload.get("payload", {}).get("subscription", {}).get("entity", {})
    payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})

    rzp_sub_id = sub_data.get("id")
    rzp_payment_id = payment_entity.get("id", "")
    notes = sub_data.get("notes", {})
    user_id = notes.get("user_id")
    plan_id = notes.get("plan_id")

    if not rzp_sub_id:
        return

    # Determine plan duration
    duration_months = 1
    if plan_id:
        try:
            plans_response = await get_subscription_plans()
            plan = next((p for p in plans_response if str(p["id"]) == str(plan_id)), None)
            if plan:
                duration_months = plan["duration_months"]
        except Exception:
            pass

    start_date = datetime.now()
    end_date = start_date + timedelta(days=duration_months * 30)

    conn = get_db()
    cur = conn.cursor(dictionary=True)
    try:
        # Lookup user by subscription id if user_id note is missing
        if not user_id:
            cur.execute(
                "SELECT id FROM users WHERE razorpay_subscription_id = %s", (rzp_sub_id,)
            )
            row = cur.fetchone()
            if row:
                user_id = row["id"]

        if not user_id:
            print(f"Webhook: cannot find user for subscription {rzp_sub_id}")
            return

        cur.execute("""
            UPDATE users SET
                is_premium = TRUE,
                subscription_status = 'active',
                razorpay_subscription_id = %s,
                payment_id = %s,
                subscription_start_date = %s,
                subscription_end_date = %s,
                subscription_expires_at = %s,
                updated_at = NOW()
            WHERE id = %s
        """, (rzp_sub_id, rzp_payment_id, start_date, end_date, end_date, user_id))

        # Upsert user_subscriptions table
        if plan_id:
            cur.execute("""
                INSERT INTO user_subscriptions
                (user_id, plan_id, status, start_date, end_date, created_at)
                VALUES (%s, %s, 'active', %s, %s, NOW())
                ON DUPLICATE KEY UPDATE
                    status='active', start_date=%s, end_date=%s, updated_at=NOW()
            """, (user_id, plan_id, start_date, end_date, start_date, end_date))

        conn.commit()
        print(f"Webhook: activated subscription {rzp_sub_id} for user {user_id}")
    finally:
        cur.close()
        conn.close()


async def _webhook_cancel_subscription(payload: dict):
    """Handle subscription.cancelled."""
    sub_data = payload.get("payload", {}).get("subscription", {}).get("entity", {})
    rzp_sub_id = sub_data.get("id")
    if not rzp_sub_id:
        return

    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE users SET
                is_premium = FALSE,
                subscription_status = 'cancelled',
                updated_at = NOW()
            WHERE razorpay_subscription_id = %s
        """, (rzp_sub_id,))

        # Also mark user_subscriptions cancelled
        cur.execute("""
            UPDATE user_subscriptions us
            JOIN users u ON u.id = us.user_id
            SET us.status = 'cancelled', us.cancelled_at = NOW(), us.updated_at = NOW()
            WHERE u.razorpay_subscription_id = %s AND us.status = 'active'
        """, (rzp_sub_id,))

        conn.commit()
        print(f"Webhook: cancelled subscription {rzp_sub_id}")
    finally:
        cur.close()
        conn.close()


async def _webhook_payment_failed(payload: dict):
    """Handle payment.failed — mark subscription inactive."""
    payment_data = payload.get("payload", {}).get("payment", {}).get("entity", {})
    description = payment_data.get("description", "")
    rzp_payment_id = payment_data.get("id", "")

    # Try to identify subscription from payment notes
    notes = payment_data.get("notes", {})
    rzp_sub_id = notes.get("razorpay_subscription_id") or payment_data.get("subscription_id")

    if not rzp_sub_id:
        print(f"Webhook payment.failed: no subscription_id in payment {rzp_payment_id}")
        return

    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE users SET
                subscription_status = 'inactive',
                is_premium = FALSE,
                updated_at = NOW()
            WHERE razorpay_subscription_id = %s
        """, (rzp_sub_id,))

        # Log the failure in payment_transactions
        cur.execute("""
            UPDATE payment_transactions
            SET payment_status = 'failed', updated_at = NOW()
            WHERE transaction_id = %s
        """, (rzp_sub_id,))

        conn.commit()
        print(f"Webhook: payment failed for subscription {rzp_sub_id}, payment {rzp_payment_id}")
    finally:
        cur.close()
        conn.close()


# =========================
# ENHANCED WATER TRACKING ROUTES
# =========================

@app.post("/api/water/adjust")
async def adjust_water_intake(request: dict, user: dict = Depends(require_auth)):
    """Adjust water intake by +1 or -1 glass"""
    try:
        adjustment = request.get("adjustment")
        if adjustment not in [-1, 1]:
            raise HTTPException(status_code=400, detail="Adjustment must be +1 or -1")
        
        conn = get_db()
        cur = conn.cursor(dictionary=True)
        
        today = date.today()
        
        # Get current total for today
        cur.execute("""
            SELECT COALESCE(SUM(glasses), 0) as current_total
            FROM water_logs
            WHERE user_id = %s AND log_date = %s
        """, (user['id'], today))
        
        result = cur.fetchone()
        current_total = int(result['current_total']) if result else 0
        
        # Calculate new total
        new_total = current_total + adjustment
        
        # Prevent negative values
        if new_total < 0:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail="Water intake cannot be negative")
        
        # If adjusting up, add a new log entry
        if adjustment > 0:
            cur.execute("""
                INSERT INTO water_logs (user_id, glasses, log_date, logged_at)
                VALUES (%s, 1, %s, NOW())
            """, (user['id'], today))
        
        # If adjusting down, remove the most recent entry
        elif adjustment < 0 and current_total > 0:
            cur.execute("""
                DELETE FROM water_logs
                WHERE user_id = %s AND log_date = %s
                ORDER BY logged_at DESC
                LIMIT 1
            """, (user['id'], today))
        
        conn.commit()
        
        # Get user's water goal
        cur.execute("""
            SELECT daily_water_goal
            FROM users
            WHERE id = %s
        """, (user['id'],))
        
        user_data = cur.fetchone()
        goal = user_data['daily_water_goal'] if user_data else 8
        
        cur.close()
        conn.close()
        
        percentage = min(100, (new_total / goal * 100)) if goal > 0 else 0
        
        return {
            "success": True,
            "current": new_total,
            "goal": goal,
            "percentage": round(percentage, 1),
            "goal_reached": new_total >= goal
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/water/today")
async def get_today_water_intake(user: dict = Depends(require_auth)):
    """Get today's water intake"""
    try:
        conn = get_db()
        cur = conn.cursor(dictionary=True)
        
        today = date.today()
        
        # Get user's water goal
        cur.execute("""
            SELECT daily_water_goal
            FROM users
            WHERE id = %s
        """, (user['id'],))
        
        user_data = cur.fetchone()
        goal = user_data['daily_water_goal'] if user_data else 8
        
        # Get today's total
        cur.execute("""
            SELECT COALESCE(SUM(glasses), 0) as total
            FROM water_logs
            WHERE user_id = %s AND log_date = %s
        """, (user['id'], today))
        
        result = cur.fetchone()
        current = int(result['total']) if result else 0
        
        cur.close()
        conn.close()
        
        percentage = min(100, (current / goal * 100)) if goal > 0 else 0
        
        return {
            "current": current,
            "goal": goal,
            "date": today.isoformat(),
            "percentage": round(percentage, 1),
            "goal_reached": current >= goal
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/water/set-goal")
async def set_water_goal(request: dict, user: dict = Depends(require_auth)):
    """Set daily water intake goal"""
    try:
        goal = request.get("goal")
        
        if not goal or goal < 1 or goal > 20:
            raise HTTPException(status_code=400, detail="Goal must be between 1 and 20 glasses")
        
        conn = get_db()
        cur = conn.cursor()
        
        cur.execute("""
            UPDATE users
            SET daily_water_goal = %s,
                updated_at = NOW()
            WHERE id = %s
        """, (goal, user['id']))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            "success": True,
            "message": f"Daily water goal set to {goal} glasses",
            "goal": goal
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/water/history")
async def get_water_history(days: int = 7, user: dict = Depends(require_auth)):
    """Get water intake history for the past N days"""
    try:
        if days < 1 or days > 30:
            raise HTTPException(status_code=400, detail="Days must be between 1 and 30")
        
        conn = get_db()
        cur = conn.cursor(dictionary=True)
        
        cur.execute("""
            SELECT 
                log_date as date,
                SUM(glasses) as glasses
            FROM water_logs
            WHERE user_id = %s 
                AND log_date >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
            GROUP BY log_date
            ORDER BY log_date DESC
        """, (user['id'], days))
        
        history = cur.fetchall()
        
        cur.close()
        conn.close()
        
        # Convert dates to strings
        for entry in history:
            entry['date'] = entry['date'].isoformat()
        
        return {
            "success": True,
            "history": history,
            "days": days
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




# =========================
# MEAL LOG BATCH ENDPOINT
# =========================

@app.post("/api/meals/log-batch")
async def log_meal_batch(req: BatchLogRequest, user=Depends(require_auth)):
    """Log multiple food items from analysis to the food diary at once."""
    conn = None
    cur = None
    try:
        conn = get_db()
        cur = conn.cursor()

        # Log to food_analysis_history
        cur.execute("""
            INSERT INTO food_analysis_history
            (user_id, food_items, total_calories, total_protein, total_carbs, total_fat, total_fiber)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            user["id"],
            json.dumps(req.items),
            req.nutrition.get("calories", 0),
            req.nutrition.get("protein", 0),
            req.nutrition.get("carbs", 0),
            req.nutrition.get("fat", 0),
            req.nutrition.get("fiber", 0),
        ))

        # Log each item to meal_logs
        items_logged = 0
        for item in req.items:
            cur.execute("""
                INSERT INTO meal_logs (user_id, food_name, calories, protein, carbs, fat, meal_type)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                user["id"],
                sanitize_input(item.get("name", "Unknown Food"), 200),
                item.get("calories", 0),
                req.nutrition.get("protein", 0),
                req.nutrition.get("carbs", 0),
                req.nutrition.get("fat", 0),
                sanitize_input(req.meal_type, 50),
            ))
            items_logged += 1

        conn.commit()

        total_calories = req.nutrition.get("calories", 0)
        return {
            "success": True,
            "logged": True,
            "items_logged": items_logged,
            "total_calories": total_calories,
            "message": f"Successfully logged {items_logged} item(s) ({total_calories} kcal) to your diary."
        }
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Batch log error: {e}")
        raise HTTPException(status_code=500, detail="Failed to log food items")
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


# =========================
# FASTING TRACKER ENDPOINTS
# =========================

@app.get("/api/fasting/plans")
def get_fasting_plans():
    """Return all available fasting plans."""
    return {"success": True, "plans": list(FASTING_PLANS.values())}


@app.get("/api/fasting/my-plan")
def get_my_fasting_plan(user=Depends(require_auth)):
    """Get the current user's saved fasting plan."""
    try:
        conn = get_db()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT fasting_plan FROM users WHERE id = %s", (user["id"],))
        row = cur.fetchone()
        cur.close()
        conn.close()
        plan_id = (row["fasting_plan"] or "none") if row else "none"
        plan = FASTING_PLANS.get(plan_id, FASTING_PLANS["none"])
        return {"success": True, "plan_id": plan_id, "plan": plan}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/fasting/set-plan")
async def set_fasting_plan(request: dict, user=Depends(require_auth)):
    """Save the user's chosen fasting plan."""
    plan_id = request.get("plan_id", "none")
    if plan_id not in FASTING_PLANS:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {plan_id}")
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("UPDATE users SET fasting_plan = %s WHERE id = %s", (plan_id, user["id"]))
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "plan_id": plan_id, "plan": FASTING_PLANS[plan_id]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/fasting/start")
async def start_fasting_session(request: dict, user=Depends(require_auth)):
    """Start a fasting session for the user."""
    try:
        conn = get_db()
        cur = conn.cursor(dictionary=True)

        # Check for already-active session
        cur.execute("""
            SELECT id FROM fasting_sessions
            WHERE user_id = %s AND end_time IS NULL
        """, (user["id"],))
        active = cur.fetchone()
        if active:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail="You already have an active fasting session.")

        # Get user's fasting plan
        cur.execute("SELECT fasting_plan FROM users WHERE id = %s", (user["id"],))
        row = cur.fetchone()
        plan_id = (row["fasting_plan"] or "none") if row else "none"
        plan = FASTING_PLANS.get(plan_id, FASTING_PLANS["none"])

        now = datetime.now()
        fast_hours = plan.get("fast_hours", 0)
        target_end = now + timedelta(hours=fast_hours) if fast_hours > 0 else None

        cur.execute("""
            INSERT INTO fasting_sessions
            (user_id, plan_type, start_time, target_end_time, completed)
            VALUES (%s, %s, %s, %s, FALSE)
        """, (user["id"], plan_id, now, target_end))
        conn.commit()
        session_id = cur.lastrowid
        cur.close()
        conn.close()

        return {
            "success": True,
            "session_id": session_id,
            "plan": plan,
            "start_time": now.isoformat(),
            "target_end_time": target_end.isoformat() if target_end else None,
            "message": f"Fasting session started ({plan['name']})."
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/fasting/end")
async def end_fasting_session(request: dict, user=Depends(require_auth)):
    """End the current fasting session."""
    try:
        conn = get_db()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT * FROM fasting_sessions
            WHERE user_id = %s AND end_time IS NULL
            ORDER BY start_time DESC LIMIT 1
        """, (user["id"],))
        session = cur.fetchone()

        if not session:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="No active fasting session found.")

        now = datetime.now()
        elapsed = (now - session["start_time"]).total_seconds() / 3600
        goal_h = FASTING_PLANS.get(session["plan_type"], {}).get("fast_hours", 0)
        completed = goal_h > 0 and elapsed >= goal_h

        cur.execute("""
            UPDATE fasting_sessions
            SET end_time = %s, completed = %s
            WHERE id = %s
        """, (now, completed, session["id"]))
        conn.commit()
        cur.close()
        conn.close()

        return {
            "success": True,
            "session_id": session["id"],
            "elapsed_hours": round(elapsed, 2),
            "goal_hours": goal_h,
            "completed": completed,
            "message": "Well done! Goal reached!" if completed else f"Session ended after {round(elapsed, 1)}h."
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/fasting/status")
def get_fasting_status(user=Depends(require_auth)):
    """Get current fasting session status with elapsed/remaining time."""
    try:
        conn = get_db()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT * FROM fasting_sessions
            WHERE user_id = %s AND end_time IS NULL
            ORDER BY start_time DESC LIMIT 1
        """, (user["id"],))
        session = cur.fetchone()
        cur.close()
        conn.close()

        if not session:
            return {"success": True, "active": False, "session": None}

        now = datetime.now()
        elapsed_sec = (now - session["start_time"]).total_seconds()
        elapsed_h = elapsed_sec / 3600
        plan = FASTING_PLANS.get(session["plan_type"], FASTING_PLANS["none"])
        goal_h = plan.get("fast_hours", 0)

        if goal_h > 0:
            progress = min(100, (elapsed_h / goal_h) * 100)
            remaining_sec = max(0, goal_h * 3600 - elapsed_sec)
        else:
            progress = 0
            remaining_sec = 0

        return {
            "success": True,
            "active": True,
            "session": {
                "id": session["id"],
                "plan_type": session["plan_type"],
                "plan": plan,
                "start_time": session["start_time"].isoformat(),
                "target_end_time": session["target_end_time"].isoformat() if session["target_end_time"] else None,
                "elapsed_seconds": int(elapsed_sec),
                "remaining_seconds": int(remaining_sec),
                "elapsed_hours": round(elapsed_h, 2),
                "goal_hours": goal_h,
                "progress_percent": round(progress, 1),
                "goal_reached": elapsed_h >= goal_h if goal_h > 0 else False,
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/fasting/history")
def get_fasting_history(days: int = 30, user=Depends(require_auth)):
    """Get fasting session history for the past N days."""
    try:
        conn = get_db()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT id, plan_type, start_time, end_time, target_end_time, completed, created_at
            FROM fasting_sessions
            WHERE user_id = %s
              AND start_time >= DATE_SUB(NOW(), INTERVAL %s DAY)
            ORDER BY start_time DESC
            LIMIT 50
        """, (user["id"], days))
        sessions = cur.fetchall()
        cur.close()
        conn.close()

        result = []
        total = len(sessions)
        completed_count = 0
        total_hours = 0.0

        for s in sessions:
            plan = FASTING_PLANS.get(s["plan_type"], FASTING_PLANS["none"])
            dur_h = 0.0
            if s["start_time"] and s["end_time"]:
                dur_h = (s["end_time"] - s["start_time"]).total_seconds() / 3600
            total_hours += dur_h
            if s["completed"]:
                completed_count += 1
            result.append({
                "id": s["id"],
                "plan_type": s["plan_type"],
                "plan_name": plan.get("name", s["plan_type"]),
                "plan_emoji": plan.get("emoji", "⏱"),
                "start_time": s["start_time"].isoformat() if s["start_time"] else None,
                "end_time": s["end_time"].isoformat() if s["end_time"] else None,
                "duration_hours": round(dur_h, 2),
                "completed": bool(s["completed"]),
            })

        avg_h = round(total_hours / total, 2) if total > 0 else 0
        success_rate = round((completed_count / total) * 100) if total > 0 else 0

        return {
            "success": True,
            "sessions": result,
            "stats": {
                "total_sessions": total,
                "completed_sessions": completed_count,
                "avg_duration_hours": avg_h,
                "success_rate_percent": success_rate,
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# SYSTEM INFORMATION
# =========================

print("=" * 60)
print("✓ NutriLife API initialized successfully")
print("=" * 60)
print(f"✓ Database connection: {'Available' if db_pool else 'Not configured'}")
print(f"✓ Google OAuth: {'Enabled' if google_auth_service else 'Disabled (optional)'}")
print(f"✓ Subscription system: {'Enabled' if subscription_service else 'Disabled (optional)'}")
print(f"✓ API Documentation: http://localhost:8000/docs")
print("=" * 60)