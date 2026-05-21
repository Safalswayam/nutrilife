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
import ipaddress
import socket
import smtplib
import ssl
import httpx
import razorpay
import threading
import time
import urllib.parse
from fastapi.responses import RedirectResponse
from email.message import EmailMessage
from email.utils import formataddr

# ── Ensure the api/ directory is on sys.path ────────────────────────────────
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

# ── Telegram Admin Notifications ─────────────────────────────────────────────
try:
    from telegram_notifier import (
        notify_new_user_email,
        notify_new_user_google,
        notify_new_subscription,
        notify_feedback,
        notify_server_start,
    )
    TELEGRAM_ENABLED = True
    print("✓ Telegram notifier loaded")
except Exception as _tg_err:
    TELEGRAM_ENABLED = False
    print(f"⚠ Telegram notifier not loaded: {_tg_err}")
    def notify_new_user_email(*a, **k): pass
    def notify_new_user_google(*a, **k): pass
    def notify_new_subscription(*a, **k): pass
    def notify_server_start(): pass


import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import pool
from openai import OpenAI

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
        (os.getenv("RAZORPAY_KEY_ID") or "").strip(),
        (os.getenv("RAZORPAY_KEY_SECRET") or "").strip()
    )
)

@app.get("/")
def health_check():
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
        "openai": "configured" if (os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY")) else "not configured",
        "smtp": "configured" if is_email_verification_configured() else "not configured",
        "email_delivery": get_email_delivery_mode()
    }

OPENROUTER_API_KEY = (os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY") or "").strip()
if not OPENROUTER_API_KEY:
    print("⚠ OpenRouter API key missing (set OPENROUTER_API_KEY or OPENAI_API_KEY)")

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
    default_headers={
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Health Diet App"
    }
)

def ask_openai(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 500,
    temperature: float = 0.4
):
    try:
        response = client.chat.completions.create(
            model="openai/gpt-4o-mini",
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


def extract_json_from_response(text: str) -> str:
    """Helper to extract JSON from AI response that might contain markdown or filler text."""
    if not text:
        return ""
    
    text = text.strip()
    
    # Try finding the first { and last }
    start = text.find('{')
    end = text.rfind('}')
    
    if start != -1 and end != -1 and end > start:
        return text[start:end+1]
    
    # Fallback to previous markdown logic
    if text.startswith("```"):
        try:
            parts = text.split("```")
            if len(parts) >= 3:
                inner = parts[1].strip()
                if inner.startswith("json"):
                    return inner[4:].strip()
                return inner
        except:
            pass
            
    return text


def ask_openai_with_history(
    system_prompt: str,
    messages: list,
    max_tokens: int = 1000,
    temperature: float = 0.4
) -> str:
    try:
        full_messages = [{"role": "system", "content": system_prompt}] + messages
        response = client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=full_messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"OpenRouter API error: {e}")
        return None


def ask_openai_with_image(
    system_prompt: str,
    user_prompt: str,
    image_base64: str,
    max_tokens: int = 900,
    detail: str = "high"
) -> str:
    try:
        response = client.chat.completions.create(
            model="openai/gpt-4o",
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

class PooledConnection:
    def __init__(self, conn, pool):
        self._conn = conn
        self._pool = pool
    def cursor(self, *args, **kwargs):
        return self._conn.cursor(*args, **kwargs)
    def commit(self):
        self._conn.commit()
    def rollback(self):
        self._conn.rollback()
    def close(self):
        if self._pool and self._conn:
            self._pool.putconn(self._conn)
            self._conn = None

DB_CONFIG = {
    "host": os.getenv("PGHOST") or os.getenv("POSTGRES_HOST", "localhost"),
    "user": os.getenv("PGUSER") or os.getenv("POSTGRES_USER", "postgres"),
    "password": os.getenv("PGPASSWORD") or os.getenv("POSTGRES_PASSWORD", "postgres"),
    "dbname": os.getenv("PGDATABASE") or os.getenv("POSTGRES_DB", "postgres"),
    "port": int(os.getenv("PGPORT") or os.getenv("POSTGRES_PORT", 5432)),
    "sslmode": os.getenv("PGSSLMODE", "prefer"),
}

db_pool = None
db_initialized = False

ALLOWED_DIRECT_SIGNUP_DOMAINS = {"gmail.com"}
EMAIL_VERIFICATION_CODE_TTL_MINUTES = max(5, int(os.getenv("EMAIL_VERIFICATION_CODE_TTL_MINUTES", "10")))
EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS = max(
    30,
    int(os.getenv("EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS", "60"))
)
EMAIL_VERIFICATION_MAX_ATTEMPTS = max(3, int(os.getenv("EMAIL_VERIFICATION_MAX_ATTEMPTS", "5")))

SMTP_HOST = (os.getenv("SMTP_HOST") or "smtp.gmail.com").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = (os.getenv("SMTP_USERNAME") or "").strip()
SMTP_PASSWORD = re.sub(r"\s+", "", os.getenv("SMTP_PASSWORD") or "")
SMTP_FROM_EMAIL = (os.getenv("SMTP_FROM_EMAIL") or SMTP_USERNAME).strip()
SMTP_FROM_NAME = (os.getenv("SMTP_FROM_NAME") or "NutriLife").strip()
SMTP_USE_TLS = (os.getenv("SMTP_USE_TLS", "true").strip().lower() not in {"0", "false", "no"})
SMTP_USE_SSL = (os.getenv("SMTP_USE_SSL", "false").strip().lower() in {"1", "true", "yes"})
RESEND_API_KEY = (os.getenv("RESEND_API_KEY") or "").strip()
RESEND_FROM_EMAIL = (os.getenv("RESEND_FROM_EMAIL") or "onboarding@resend.dev").strip()

ALLOW_CONSOLE_EMAIL_VERIFICATION = (
    os.getenv("ALLOW_CONSOLE_EMAIL_VERIFICATION", "true").strip().lower() not in {"0", "false", "no"}
)

def init_db_pool():
    global db_pool, db_initialized
    if db_initialized and db_pool is not None:
        return True
    try:
        from urllib.parse import urlparse
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            db_pool = pool.ThreadedConnectionPool(1, 20, dsn=database_url)
        else:
            db_pool = pool.ThreadedConnectionPool(1, 20, **DB_CONFIG)
        db_initialized = True
        print("Database pool initialized successfully")
        return True
    except Exception as e:
        db_initialized = False
        print(f"Database pool initialization error: {e}")
        return False

def get_db():
    global db_pool, db_initialized
    if not db_initialized or db_pool is None:
        if not init_db_pool():
            raise HTTPException(status_code=503, detail="Database service unavailable")
    try:
        conn = db_pool.getconn()
        return PooledConnection(conn, db_pool)
    except psycopg2.Error as e:
        print(f"Database connection error: {e}")
        db_initialized = False
        if init_db_pool():
            try:
                conn = db_pool.getconn()
                return PooledConnection(conn, db_pool)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail="Database connection failed")
    except Exception as e:
        print(f"Database connection error: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")

def init_database():
    try:
        conn = get_db()
        cur = conn.cursor()

        cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
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
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ,
            is_active BOOLEAN DEFAULT TRUE,
            failed_login_attempts INT DEFAULT 0,
            locked_until TIMESTAMP
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            token_hash VARCHAR(255) UNIQUE NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            is_valid BOOLEAN DEFAULT TRUE,
            ip_address VARCHAR(50),
            user_agent VARCHAR(500),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS email_verifications (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            code_hash VARCHAR(255) NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            attempts INT NOT NULL DEFAULT 0,
            used_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS meal_logs (
            id SERIAL PRIMARY KEY,
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

        cur.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            role VARCHAR(20) NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS saved_diet_plans (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            plan_data JSONB NOT NULL,
            name VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS water_logs (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            glasses INT DEFAULT 1,
            logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            log_date DATE NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS daily_stats (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            stat_date DATE NOT NULL,
            total_calories INT DEFAULT 0,
            total_protein FLOAT DEFAULT 0,
            total_carbs FLOAT DEFAULT 0,
            total_fat FLOAT DEFAULT 0,
            total_fiber FLOAT DEFAULT 0,
            water_glasses INT DEFAULT 0,
            weight FLOAT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE (user_id, stat_date)
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS food_analysis_history (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            food_items JSONB NOT NULL,
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

        cur.execute("""
        CREATE TABLE IF NOT EXISTS subscription_plans (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50) NOT NULL,
            duration_months INT NOT NULL,
            base_price DECIMAL(10,2) NOT NULL,
            final_price DECIMAL(10,2) NOT NULL,
            discount_amount DECIMAL(10,2) DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            features JSONB,
            badge VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ,
            UNIQUE (duration_months)
        ) 
        """)

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
            ON CONFLICT (duration_months) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
            """)
            print("  ✓ Seeded default subscription plans")

        cur.execute("""
        CREATE TABLE IF NOT EXISTS user_subscriptions (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            plan_id INT NOT NULL,
            status VARCHAR(50) CHECK (status IN ('active','expired','cancelled','pending')) DEFAULT 'pending',
            start_date TIMESTAMP NOT NULL,
            end_date TIMESTAMP NOT NULL,
            auto_renew BOOLEAN DEFAULT FALSE,
            cancelled_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
        ) 
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS payment_transactions (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            subscription_id INT,
            plan_id INT NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            currency VARCHAR(3) DEFAULT 'INR',
            payment_status VARCHAR(50) CHECK (payment_status IN ('pending','completed','failed','refunded')) DEFAULT 'pending',
            payment_method VARCHAR(50),
            transaction_id VARCHAR(255) UNIQUE,
            payment_gateway VARCHAR(50),
            gateway_response JSONB,
            metadata JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
        ) 
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS feature_access (
            id SERIAL PRIMARY KEY,
            feature_name VARCHAR(100) NOT NULL UNIQUE,
            requires_premium BOOLEAN DEFAULT TRUE,
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) 
        """)

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
            ON CONFLICT (feature_name) DO UPDATE SET requires_premium = EXCLUDED.requires_premium
            """)
            cur.execute("UPDATE feature_access SET requires_premium = FALSE WHERE feature_name = 'diet_planner'")
            print("  ✓ Seeded feature access rules")

        cur.execute("""
        CREATE TABLE IF NOT EXISTS subscription_audit_log (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            subscription_id INT,
            action VARCHAR(50) NOT NULL,
            old_status VARCHAR(50),
            new_status VARCHAR(50),
            details JSONB,
            ip_address VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) 
        """)

        def _add_column_if_missing(table, column, definition):
            cur.execute("""
                SELECT COUNT(*) as cnt
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE table_schema = 'public'
                  AND TABLE_NAME   = %s
                  AND COLUMN_NAME  = %s
            """, (table, column))
            row = cur.fetchone()
            count = row['cnt'] if isinstance(row, dict) else row[0]
            if count == 0:
                cur.execute(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {definition}')
                print(f"  ✓ Added column {table}.{column}")

        new_user_columns = [
            ("subscription_status",        "VARCHAR(50) CHECK (subscription_status IN ('inactive','active','cancelled')) NOT NULL DEFAULT 'inactive'"),
            ("razorpay_customer_id",        "VARCHAR(255)"),
            ("razorpay_subscription_id",    "VARCHAR(255)"),
            ("payment_id",                  "VARCHAR(255)"),
            ("subscription_start_date",     "TIMESTAMP"),
            ("subscription_end_date",       "TIMESTAMP"),
            ("google_id",                   "VARCHAR(255)"),
            ("profile_image",               "TEXT"),      # stores base64 image data URL
            ("auth_provider",               "VARCHAR(50) DEFAULT 'email'"),
            ("email_verified",              "BOOLEAN NOT NULL DEFAULT TRUE"),
            ("email_verified_at",           "TIMESTAMP NULL"),
            ("is_premium",                  "BOOLEAN NOT NULL DEFAULT FALSE"),
            ("subscription_expires_at",     "TIMESTAMP"),
            ("fasting_plan",               "VARCHAR(50) DEFAULT 'none'"),
            ("daily_water_goal",            "INT DEFAULT 8"),
            ("health_issues",               "TEXT"), # JSONB-like CSV or text
            ("extra_habits",                "TEXT"),
        ]
        for col_name, col_def in new_user_columns:
            try:
                _add_column_if_missing("users", col_name, col_def)
                conn.commit()
            except Exception as col_err:
                conn.rollback()
                print(f"  ⚠ Could not add column users.{col_name}: {col_err}")

        cur.execute("""
        CREATE TABLE IF NOT EXISTS razorpay_webhook_events (
            id SERIAL PRIMARY KEY,
            event_id VARCHAR(255) UNIQUE NOT NULL,
            event_type VARCHAR(100) NOT NULL,
            payload JSONB NOT NULL,
            processed BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS fasting_sessions (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            plan_type VARCHAR(50) NOT NULL DEFAULT 'none',
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP,
            target_end_time TIMESTAMP,
            completed BOOLEAN DEFAULT FALSE,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS password_resets (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            token_hash VARCHAR(255) NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS diet_plans (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            plan_name VARCHAR(255),
            start_date DATE,
            end_date DATE,
            target_calories INT DEFAULT 2000,
            target_protein DECIMAL(10,2) DEFAULT 0,
            target_carbs DECIMAL(10,2) DEFAULT 0,
            target_fat DECIMAL(10,2) DEFAULT 0,
            weekly_plan JSONB,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        conn.commit()

        # Migration: add missing columns to diet_plans if they don't exist
        migrations = [
            ("is_active", "ALTER TABLE diet_plans ADD COLUMN is_active BOOLEAN DEFAULT TRUE"),
            ("plan_name", "ALTER TABLE diet_plans ADD COLUMN plan_name VARCHAR(255)"),
            ("start_date", "ALTER TABLE diet_plans ADD COLUMN start_date DATE"),
            ("end_date", "ALTER TABLE diet_plans ADD COLUMN end_date DATE"),
            ("target_calories", "ALTER TABLE diet_plans ADD COLUMN target_calories INT DEFAULT 2000"),
            ("target_protein", "ALTER TABLE diet_plans ADD COLUMN target_protein DECIMAL(10,2) DEFAULT 0"),
            ("target_carbs", "ALTER TABLE diet_plans ADD COLUMN target_carbs DECIMAL(10,2) DEFAULT 0"),
            ("target_fat", "ALTER TABLE diet_plans ADD COLUMN target_fat DECIMAL(10,2) DEFAULT 0"),
        ]
        migration_cur = conn.cursor()
        for col_name, sql in migrations:
            try:
                migration_cur.execute(sql)
                conn.commit()
                print(f"Migration applied: added column '{col_name}' to diet_plans")
            except psycopg2.Error as me:
                conn.rollback()
                if getattr(me, 'pgcode', None) == '42701':  # Duplicate column — already exists, skip
                    pass
                else:
                    print(f"Migration warning for '{col_name}': {me}")
        migration_cur.close()

        cur.close()
        conn.close()
        print("Database tables initialized successfully")
        return True
    except psycopg2.Error as e:
        print(f"Database initialization error: {e}")
        return False
    except Exception as e:
        print(f"Database initialization error: {e}")
        return False

def start_uptime_bot():
    """
    Starts a background thread that pings the backend every 14 minutes
    to prevent Render free instances from sleeping.
    """
    def ping_loop():
        # RENDER_EXTERNAL_URL is automatically set by Render
        base_url = os.getenv("RENDER_EXTERNAL_URL") or os.getenv("BACKEND_URL")
        if not base_url:
            print("⚠ Uptime bot: RENDER_EXTERNAL_URL or BACKEND_URL not set. Bot skipping.")
            return
            
        url = f"{base_url.rstrip('/')}/health"
        # Initial delay to allow the server to fully boot
        time.sleep(30)
        print(f"🚀 Uptime bot started. Target: {url}")
        
        while True:
            try:
                with httpx.Client(timeout=15) as client:
                    r = client.get(url)
                    print(f"💓 Uptime bot ping ({datetime.now().strftime('%H:%M:%S')}): {r.status_code}")
            except Exception as e:
                print(f"❌ Uptime bot ping failed: {e}")
            
            # Ping every 14 minutes (Render sleeps after 15 min)
            time.sleep(14 * 60)

    thread = threading.Thread(target=ping_loop, daemon=True)
    thread.start()

def startup_init():
    if init_db_pool():
        init_database()
    else:
        print("Warning: Database not available. Some features may not work.")
    # Notify admin that server has started
    notify_server_start()
    # Start the uptime bot to keep Render alive
    start_uptime_bot()

startup_init()

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

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except Exception:
        return False

def generate_token() -> str:
    return secrets.token_urlsafe(64)

def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()

def sanitize_input(value: str, max_length: int = 500) -> str:
    if not value:
        return ""
    value = value.replace('\x00', '')
    return value[:max_length].strip()

def normalize_email(email: str) -> str:
    normalized = (email or "").strip().lower()
    if normalized.endswith("@googlemail.com"):
        normalized = f"{normalized[:-15]}@gmail.com"
    return normalized

def validate_email(email: str) -> bool:
    email = normalize_email(email)
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email)) and len(email) <= 254

def validate_gmail_address(email: str) -> bool:
    email = normalize_email(email)
    if not validate_email(email):
        return False
    _, _, domain = email.partition("@")
    return domain in ALLOWED_DIRECT_SIGNUP_DOMAINS

def validate_password_strength(password: str) -> tuple:
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

def generate_verification_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"

def is_resend_configured() -> bool:
    return bool(RESEND_API_KEY)

def is_email_verification_configured() -> bool:
    return bool(SMTP_HOST and SMTP_PORT and SMTP_USERNAME and SMTP_PASSWORD and SMTP_FROM_EMAIL)

def get_email_delivery_mode() -> str:
    if is_resend_configured():
        return "resend"
    if is_email_verification_configured():
        return "smtp"
    if ALLOW_CONSOLE_EMAIL_VERIFICATION:
        return "console-fallback"
    return "not configured"

def _send_email_via_resend(to_email: str, subject: str, text_body: str, html_body: str) -> None:
    """Send an email via Resend HTTP API. Works on all hosts including Render."""
    from_addr = formataddr((SMTP_FROM_NAME, RESEND_FROM_EMAIL))
    response = httpx.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "from": from_addr,
            "to": [to_email],
            "subject": subject,
            "text": text_body,
            "html": html_body,
        },
        timeout=15,
    )
    response.raise_for_status()

def _smtp_connect(host, port, timeout=20):
    """Create SMTP connection forcing IPv4 to avoid 'Network is unreachable' on hosts without IPv6."""
    use_ssl = SMTP_USE_SSL or port == 465
    # Resolve hostname to IPv4 explicitly
    ipv4_addrs = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)
    if not ipv4_addrs:
        raise Exception(f"Cannot resolve {host} to IPv4")
    ipv4_ip = ipv4_addrs[0][4][0]
    # Create raw IPv4 socket
    sock = socket.create_connection((ipv4_ip, port), timeout=timeout)
    if use_ssl:
        ctx = ssl.create_default_context()
        sock = ctx.wrap_socket(sock, server_hostname=host)
        server = smtplib.SMTP_SSL(host, port)
        server.sock = sock
        server._host = host
    else:
        server = smtplib.SMTP(host, port)
        server.sock = sock
        server._host = host
        server.ehlo()
        if SMTP_USE_TLS:
            server.starttls(context=ssl.create_default_context())
            server.ehlo()
    server.ehlo()
    return server

def is_local_request(request: Request) -> bool:
    client_host = (request.client.host if request.client else "") or ""
    url_host = (request.url.hostname or "") if request.url else ""

    for host in (client_host, url_host):
        if not host:
            continue
        if host in {"127.0.0.1", "::1", "localhost"}:
            return True
        try:
            if ipaddress.ip_address(host).is_loopback:
                return True
        except ValueError:
            continue

    return False

def build_verification_email_content(email: str, name: str, code: str) -> tuple[str, str, str, str]:
    recipient_name = sanitize_input(name, 100) or "there"
    subject = f"{SMTP_FROM_NAME} verification code"
    text_body = (
        f"Hi {recipient_name},\n\n"
        f"Your NutriLife verification code is {code}.\n"
        f"It expires in {EMAIL_VERIFICATION_CODE_TTL_MINUTES} minutes.\n\n"
        "If you didn't request this, you can ignore this email."
    )
    html_body = f"""
        <html>
          <body style="font-family: Arial, sans-serif; color: #111827;">
            <p>Hi {recipient_name},</p>
            <p>Your NutriLife verification code is:</p>
            <p style="font-size: 28px; font-weight: bold; letter-spacing: 8px;">{code}</p>
            <p>This code expires in {EMAIL_VERIFICATION_CODE_TTL_MINUTES} minutes.</p>
            <p>If you didn't request this, you can ignore this email.</p>
          </body>
        </html>
    """
    return recipient_name, subject, text_body, html_body

def build_reset_password_email_content(email: str, name: str, token: str, frontend_url: str) -> tuple[str, str, str, str]:
    recipient_name = sanitize_input(name, 100) or "there"
    subject = f"Reset your {SMTP_FROM_NAME} password"
    
    reset_link = f"{frontend_url}/reset-password?token={token}&email={email}"
    
    text_body = (
        f"Hi {recipient_name},\n\n"
        f"We received a request to reset your NutriLife password.\n"
        f"Click the link below to set a new password:\n\n"
        f"{reset_link}\n\n"
        f"This link will expire in 2 hours.\n"
        "If you didn't request this, you can ignore this email."
    )
    html_body = f"""
        <html>
          <body style="font-family: Arial, sans-serif; color: #111827;">
            <p>Hi {recipient_name},</p>
            <p>We received a request to reset your NutriLife password.</p>
            <p>Click the button below to set a new password:</p>
            <div style="margin: 24px 0;">
                <a href="{reset_link}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Reset Password</a>
            </div>
            <p>Alternatively, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #6b7280; font-size: 14px;">{reset_link}</p>
            <p>This link will expire in 2 hours.</p>
            <p>If you didn't request this, you can ignore this email.</p>
          </body>
        </html>
    """
    return recipient_name, subject, text_body, html_body

def send_email_verification_code(email: str, name: str, code: str) -> None:
    if not is_email_verification_configured():
        raise HTTPException(
            status_code=503,
            detail="Email verification is not configured on the server. Add SMTP settings before using direct sign up."
        )

    recipient_name, subject, text_body, html_body = build_verification_email_content(email, name, code)
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((SMTP_FROM_NAME, SMTP_FROM_EMAIL))
    msg["To"] = email
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    try:
        server = _smtp_connect(SMTP_HOST, SMTP_PORT)
        try:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
        finally:
            server.quit()
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Email verification send error: {exc}")
        raise HTTPException(
            status_code=503,
            detail="We couldn't send a verification code right now. Please try again in a moment."
        )



def create_email_verification_record(cur, user_id: int) -> str:
    cur.execute("""
        SELECT id, created_at
        FROM email_verifications
        WHERE user_id = %s
          AND used_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
    """, (user_id,))
    latest_code = cur.fetchone()

    if latest_code and latest_code.get("created_at"):
        elapsed = (datetime.now() - latest_code["created_at"]).total_seconds()
        if elapsed < EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS:
            wait_seconds = int(math.ceil(EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS - elapsed))
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {wait_seconds} seconds before requesting another verification code."
            )

    cur.execute("""
        UPDATE email_verifications
        SET used_at = NOW()
        WHERE user_id = %s
          AND used_at IS NULL
    """, (user_id,))

    code = generate_verification_code()
    cur.execute("""
        INSERT INTO email_verifications (user_id, code_hash, expires_at)
        VALUES (%s, %s, %s)
    """, (
        user_id,
        hash_token(code),
        datetime.now() + timedelta(minutes=EMAIL_VERIFICATION_CODE_TTL_MINUTES)
    ))
    return code

def deliver_verification_code(email: str, name: str, code: str, request: Request) -> str:
    recipient_name, subject, text_body, html_body = build_verification_email_content(email, name, code)

    # Try Resend HTTP API first (works on Render and all cloud hosts)
    if is_resend_configured():
        try:
            _send_email_via_resend(email, subject, text_body, html_body)
            return "We sent a 6-digit verification code to your Gmail address."
        except Exception as e:
            print(f"Resend delivery failed: {e}")

    # Fallback to direct SMTP (works locally)
    if is_email_verification_configured():
        try:
            send_email_verification_code(email, name, code)
            return "We sent a 6-digit verification code to your Gmail address."
        except Exception as e:
            print(f"SMTP delivery failed: {e}")

    if ALLOW_CONSOLE_EMAIL_VERIFICATION and is_local_request(request):
        print("\n" + "="*60)
        print(f"VERIFICATION CODE for {email}: {code}")
        print("="*60 + "\n")
        return (
            "For testing, your 6-digit verification code has been printed in the API terminal."
        )

    raise HTTPException(
        status_code=503,
        detail="Could not deliver verification email. Please check email settings and try again."
    )

def deliver_reset_password_link(email: str, name: str, token: str, request: Request) -> str:
    errors = []
    
    frontend_url = os.getenv("FRONTEND_URL")
    if not frontend_url:
        origin = request.headers.get("origin")
        if origin:
            frontend_url = origin
        else:
            referer = request.headers.get("referer")
            if referer:
                from urllib.parse import urlparse
                parsed = urlparse(referer)
                frontend_url = f"{parsed.scheme}://{parsed.netloc}"
            else:
                frontend_url = "http://localhost:3000"

    recipient_name, subject, text_body, html_body = build_reset_password_email_content(email, name, token, frontend_url)
    
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((SMTP_FROM_NAME, SMTP_FROM_EMAIL))
    msg["To"] = email
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    # Try Resend HTTP API first (works on Render and all cloud hosts)
    if is_resend_configured():
        try:
            _send_email_via_resend(email, subject, text_body, html_body)
            return "A password reset link has been sent to your email."
        except Exception as e:
            errors.append(f"Resend failure: {str(e)}")
            print(f"Resend reset email failed: {e}")

    # Fallback to direct SMTP (works locally)
    if is_email_verification_configured():
        try:
            server = _smtp_connect(SMTP_HOST, SMTP_PORT)
            try:
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
                server.send_message(msg)
            finally:
                server.quit()
            return "A password reset link has been sent to your email."
        except Exception as e:
            errors.append(f"SMTP failure: {str(e)}")

    if ALLOW_CONSOLE_EMAIL_VERIFICATION and is_local_request(request):
        print("\n" + "="*60)
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        reset_link = f"{frontend_url}/reset-password?token={token}&email={email}"
        print(f"PASSWORD RESET LINK for {email}: {reset_link}")
        print("="*60 + "\n")
        return "Reset link printed to the API terminal (Local Dev Mode)."

    raise HTTPException(status_code=503, detail="Could not deliver reset email. Please contact support.")

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    
    token_hash = hash_token(credentials.credentials)
    
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT u.id, u.email, u.name, u.gender, u.age, u.height, u.weight,
                   u.activity_level, u.metabolism_type, u.goal,
                   COALESCE(u.is_premium, FALSE)            AS is_premium,
                   COALESCE(u.subscription_status,'inactive') AS subscription_status,
                   u.subscription_expires_at,
                   u.profile_image, u.auth_provider,
                   u.razorpay_subscription_id,
                   u.subscription_start_date,
                   u.subscription_end_date,
                   u.health_issues, u.extra_habits
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
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user = get_current_user(credentials)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return user


def require_premium(user: dict = Depends(require_auth)):
    sub_status = user.get("subscription_status", "inactive")
    is_premium = user.get("is_premium", False)

    if sub_status != "active" and not is_premium:
        raise HTTPException(
            status_code=403,
            detail="Premium subscription required. Please subscribe to access this feature."
        )
    return user

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    gender: Optional[str] = None
    age: Optional[int] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    health_issues: Optional[List[str]] = []
    extra_habits: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email_field(cls, v: str) -> str:
        normalized = normalize_email(v)
        if not validate_email(normalized):
            raise ValueError("Invalid email format")
        if not validate_gmail_address(normalized):
            raise ValueError("Only Gmail addresses are allowed for direct sign up")
        return normalized

    @field_validator("name")
    @classmethod
    def validate_name_field(cls, v: str) -> str:
        if not v or len(v.strip()) < 2:
          raise ValueError("Name must be at least 2 characters")
        return sanitize_input(v, 100)

class VerifyEmailRequest(BaseModel):
    email: str
    code: str

    @field_validator("email")
    @classmethod
    def validate_email_field(cls, v: str) -> str:
        normalized = normalize_email(v)
        if not validate_email(normalized):
            raise ValueError("Invalid email format")
        return normalized

    @field_validator("code")
    @classmethod
    def validate_code_field(cls, v: str) -> str:
        code = re.sub(r"\s+", "", v or "")
        if not re.fullmatch(r"\d{6}", code):
            raise ValueError("Verification code must be 6 digits")
        return code

class ResendVerificationRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email_field(cls, v: str) -> str:
        normalized = normalize_email(v)
        if not validate_email(normalized):
            raise ValueError("Invalid email format")
        return normalized

class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email_field(cls, v: str) -> str:
        normalized = normalize_email(v)
        if not validate_email(normalized):
            raise ValueError("Invalid email format")
        return normalized

class ResetPasswordRequest(BaseModel):
    token: str
    email: str
    new_password: str

    @field_validator("email")
    @classmethod
    def validate_email_field(cls, v: str) -> str:
        normalized = normalize_email(v)
        if not validate_email(normalized):
            raise ValueError("Invalid email format")
        return normalized

class AuthResponse(BaseModel):
    success: bool
    message: str
    token: Optional[str] = None
    user: Optional[dict] = None
    requires_verification: bool = False
    verification_email: Optional[str] = None

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    activity_level: Optional[str] = None
    metabolism_type: Optional[str] = None
    goal: Optional[str] = None
    health_issues: Optional[List[str]] = None
    extra_habits: Optional[str] = None

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
    diet_type: str = "non_veg"
    dietary_restrictions: List[str] = []
    fasting_plan: Optional[str] = "none"
    health_issues: List[str] = []
    extra_habits: Optional[str] = None

class BatchLogRequest(BaseModel):
    items: List[dict]
    nutrition: dict
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

class FeedbackRequest(BaseModel):
    message: str
    name: Optional[str] = "Anonymous"
    email: Optional[str] = "Not provided"

class BMIResult(BaseModel):
    bmi: float
    category: str
    healthy_weight_range: str

class BodyAnalysisRequest(BaseModel):
    image_base64: str
    gender: Optional[str] = "male"

class BodyAnalysisResponse(BaseModel):
    success: bool
    height: float
    weight: float
    bmi: float
    category: str
    notes: Optional[str] = None

class DietPlanResponse(BaseModel):
    success: bool
    bmi_result: BMIResult
    bmr: float
    tdee: float
    target_calories: int
    macro_targets: dict
    weekly_plan: List[DayPlan]
    tips: List[str]

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
    "paneer tikka": {"calories": 260, "protein": 18, "carbs": 6, "fat": 18, "fiber": 2, "sugar": 2, "sodium": 580},
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
    "greek yogurt": {"calories": 130, "protein": 15, "carbs": 6, "fat": 5, "fiber": 0, "sugar": 4, "sodium": 60},
    "ice cream": {"calories": 207, "protein": 4, "carbs": 24, "fat": 11, "fiber": 0.7, "sugar": 21, "sodium": 80},
    "cake": {"calories": 352, "protein": 5, "carbs": 52, "fat": 14, "fiber": 1, "sugar": 36, "sodium": 299},
    "coffee": {"calories": 2, "protein": 0.3, "carbs": 0, "fat": 0, "fiber": 0, "sugar": 0, "sodium": 5},
    "smoothie": {"calories": 230, "protein": 6, "carbs": 45, "fat": 3, "fiber": 4, "sugar": 35, "sodium": 80},
    "oats": {"calories": 150, "protein": 6, "carbs": 27, "fat": 3, "fiber": 4, "sugar": 1, "sodium": 2},
    "quinoa": {"calories": 222, "protein": 8, "carbs": 39, "fat": 3.5, "fiber": 5, "sugar": 0, "sodium": 13},
    "protein shake": {"calories": 120, "protein": 24, "carbs": 3, "fat": 1.5, "fiber": 1, "sugar": 1, "sodium": 150},
    "almonds": {"calories": 164, "protein": 6, "carbs": 6, "fat": 14, "fiber": 3.5, "sugar": 1, "sodium": 1},
    "avocado": {"calories": 240, "protein": 3, "carbs": 12, "fat": 22, "fiber": 10, "sugar": 1, "sodium": 10},
    "sweet potato": {"calories": 112, "protein": 2, "carbs": 26, "fat": 0.1, "fiber": 4, "sugar": 5, "sodium": 70},
    "broccoli": {"calories": 31, "protein": 2.5, "carbs": 6, "fat": 0.3, "fiber": 2.4, "sugar": 1.5, "sodium": 30},
    "dark chocolate": {"calories": 170, "protein": 2, "carbs": 13, "fat": 12, "fiber": 3, "sugar": 7, "sodium": 6},
    "peanut butter": {"calories": 94, "protein": 4, "carbs": 3, "fat": 8, "fiber": 1, "sugar": 1, "sodium": 70},
    "tofu": {"calories": 76, "protein": 8, "carbs": 2, "fat": 4.8, "fiber": 1, "sugar": 0, "sodium": 7},
    "lentil soup": {"calories": 180, "protein": 10, "carbs": 30, "fat": 2, "fiber": 8, "sugar": 2, "sodium": 450},
    "idli": {"calories": 65, "protein": 2, "carbs": 13, "fat": 0.2, "fiber": 1, "sugar": 0.5, "sodium": 150},
    "dosa": {"calories": 168, "protein": 4, "carbs": 30, "fat": 4, "fiber": 2, "sugar": 1, "sodium": 350},
    "samosa": {"calories": 130, "protein": 2, "carbs": 15, "fat": 7, "fiber": 1, "sugar": 1, "sodium": 300},
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

@app.get("/")
def root():
    return {"status": "NutriLife API running", "version": "1.0.0"}

@app.get("/api/health")
def api_health_check():
    health_status = {
        "status": "healthy",
        "api": "running",
        "version": "1.0.0",
        "database": "unknown",
        "openai": "unknown"
    }
    
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
    
    if os.getenv("OPENROUTER_API_KEY"):
        health_status["openai"] = "configured"
    else:
        health_status["openai"] = "not_configured"
        health_status["status"] = "degraded"
    
    return health_status


@app.post("/api/feedback")
def submit_feedback(data: FeedbackRequest):
    try:
        notify_feedback(
            content=data.message,
            name=data.name,
            email=data.email
        )
        return {"success": True, "message": "Feedback sent to admin"}
    except Exception as e:
        print(f"Feedback error: {e}")
        raise HTTPException(status_code=500, detail="Failed to send feedback")


@app.get("/api/db-test")
def db_test():
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

@app.post("/api/auth/register", response_model=AuthResponse)
def register(data: RegisterRequest, request: Request):
    conn = None
    cur = None

    try:
        print(f"[v0] Registration attempt for: {data.email}")

        is_valid, message = validate_password_strength(data.password)
        if not is_valid:
            raise HTTPException(status_code=400, detail=message)

        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT id, auth_provider, COALESCE(email_verified, TRUE) AS email_verified
            FROM users
            WHERE email = %s
        """, (data.email,))
        existing_user = cur.fetchone()

        password_hash = hash_password(data.password)

        if existing_user:
            if existing_user.get("auth_provider") == "google":
                raise HTTPException(
                    status_code=400,
                    detail="This Gmail address is already linked to Google Sign-In. Use Google to continue."
                )
            if existing_user.get("email_verified", True):
                raise HTTPException(status_code=400, detail="Email already registered")

            user_id = existing_user["id"]
            cur.execute("""
                UPDATE users
                SET password_hash = %s,
                    name = %s,
                    gender = %s,
                    age = %s,
                    height = %s,
                    weight = %s,
                    email_verified = FALSE,
                    email_verified_at = NULL
                WHERE id = %s
            """, (
                password_hash,
                data.name,
                data.gender,
                data.age,
                data.height,
                data.weight,
                user_id
            ))
        else:
            cur.execute("""
                INSERT INTO users (
                    email, password_hash, name, gender, age, height, weight,
                    auth_provider, email_verified, email_verified_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'email', FALSE, NULL)
                RETURNING id
            """, (
                data.email,
                password_hash,
                data.name,
                data.gender,
                data.age,
                data.height,
                data.weight
            ))
            user_id = cur.fetchone()['id']

        code = create_email_verification_record(cur, user_id)
        verification_message = deliver_verification_code(data.email, data.name, code, request)
        conn.commit()

        # ── Telegram: notify admin of new registration ─────────────────────
        return AuthResponse(
            success=True,
            message=verification_message,
            requires_verification=True,
            verification_email=data.email
        )

    except HTTPException:
        if conn:
            conn.rollback()
        raise

    except psycopg2.Error as e:
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


@app.post("/api/auth/verify-email", response_model=AuthResponse)
def verify_email(data: VerifyEmailRequest, request: Request):
    conn = None
    cur = None

    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT id, email, name, gender, age, auth_provider,
                   COALESCE(email_verified, TRUE) AS email_verified
            FROM users
            WHERE email = %s
        """, (data.email,))
        user = cur.fetchone()

        if not user or user.get("auth_provider") != "email":
            raise HTTPException(status_code=400, detail="No email verification is pending for this account.")

        if user.get("email_verified", True):
            raise HTTPException(status_code=400, detail="This email is already verified. Please sign in.")

        cur.execute("""
            SELECT id, code_hash, expires_at, attempts
            FROM email_verifications
            WHERE user_id = %s
              AND used_at IS NULL
            ORDER BY created_at DESC
            LIMIT 1
        """, (user["id"],))
        verification = cur.fetchone()

        if not verification:
            raise HTTPException(status_code=400, detail="No active verification code found. Request a new one.")

        if verification["expires_at"] < datetime.now():
            cur.execute("UPDATE email_verifications SET used_at = NOW() WHERE id = %s", (verification["id"],))
            conn.commit()
            raise HTTPException(status_code=400, detail="Verification code expired. Request a new one.")

        if verification["attempts"] >= EMAIL_VERIFICATION_MAX_ATTEMPTS:
            cur.execute("UPDATE email_verifications SET used_at = NOW() WHERE id = %s", (verification["id"],))
            conn.commit()
            raise HTTPException(status_code=400, detail="Too many invalid attempts. Request a new code.")

        if verification["code_hash"] != hash_token(data.code):
            next_attempts = verification["attempts"] + 1
            if next_attempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS:
                cur.execute("""
                    UPDATE email_verifications
                    SET attempts = %s, used_at = NOW()
                    WHERE id = %s
                """, (next_attempts, verification["id"]))
            else:
                cur.execute("""
                    UPDATE email_verifications
                    SET attempts = %s
                    WHERE id = %s
                """, (next_attempts, verification["id"]))
            conn.commit()

            if next_attempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS:
                raise HTTPException(status_code=400, detail="Too many invalid attempts. Request a new code.")
            raise HTTPException(status_code=400, detail="Invalid verification code.")

        cur.execute("""
            UPDATE users
            SET email_verified = TRUE,
                email_verified_at = NOW()
            WHERE id = %s
        """, (user["id"],))

        cur.execute("""
            UPDATE email_verifications
            SET used_at = NOW()
            WHERE user_id = %s
              AND used_at IS NULL
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

        notify_new_user_email(
            user_id=user["id"],
            name=user["name"],
            email=user["email"],
            gender=user.get("gender"),
            age=user.get("age"),
            ip=request.client.host if request.client else None,
        )

        return AuthResponse(
            success=True,
            message="Email verified successfully",
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
        print(f"Email verification error: {e}")
        raise HTTPException(status_code=500, detail="Email verification failed")

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@app.post("/api/auth/resend-verification", response_model=AuthResponse)
def resend_verification(data: ResendVerificationRequest, request: Request):
    conn = None
    cur = None

    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT id, email, name, auth_provider, COALESCE(email_verified, TRUE) AS email_verified
            FROM users
            WHERE email = %s
        """, (data.email,))
        user = cur.fetchone()

        if not user or user.get("auth_provider") != "email":
            raise HTTPException(status_code=400, detail="No email verification is pending for this account.")

        if user.get("email_verified", True):
            raise HTTPException(status_code=400, detail="This email is already verified. Please sign in.")

        code = create_email_verification_record(cur, user["id"])
        verification_message = deliver_verification_code(user["email"], user["name"], code, request)
        conn.commit()

        return AuthResponse(
            success=True,
            message=verification_message,
            requires_verification=True,
            verification_email=user["email"]
        )

    except HTTPException:
        if conn:
            conn.rollback()
        raise

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Resend verification error: {e}")
        raise HTTPException(status_code=500, detail="Could not resend verification code")

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
        email = normalize_email(data.email)
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT id, email, name, password_hash, is_active,
                   auth_provider, COALESCE(email_verified, TRUE) AS email_verified,
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

        if user.get("auth_provider") == "email" and not user.get("email_verified", True):
            raise HTTPException(
                status_code=403,
                detail="Please verify your Gmail address before logging in. Request a new code from the sign up page if needed."
            )

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

@app.post("/api/auth/forgot-password")
def forgot_password(data: ForgotPasswordRequest, request: Request):
    conn = None
    cur = None
    try:
        email = normalize_email(data.email)
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("SELECT id, email, name FROM users WHERE email = %s", (email,))
        user = cur.fetchone()

        if not user:
            # For security, don't reveal that the user doesn't exist
            return {"success": True, "message": "If this email is registered, you will receive a reset link shortly."}

        token = secrets.token_urlsafe(32)
        token_hash = hash_token(token)
        expires_at = datetime.now() + timedelta(hours=2)

        cur.execute("""
            INSERT INTO password_resets (user_id, token_hash, expires_at)
            VALUES (%s, %s, %s)
        """, (user["id"], token_hash, expires_at))
        
        message = deliver_reset_password_link(user["email"], user["name"], token, request)
        conn.commit()

        return {"success": True, "message": message}
    except Exception as e:
        if conn: conn.rollback()
        print(f"Forgot password error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process request")
    finally:
        if cur: cur.close()
        if conn: conn.close()

@app.post("/api/auth/reset-password")
def reset_password(data: ResetPasswordRequest):
    conn = None
    cur = None
    try:
        email = normalize_email(data.email)
        token_hash = hash_token(data.token)
        
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT pr.id, pr.user_id, pr.expires_at, u.email
            FROM password_resets pr
            JOIN users u ON u.id = pr.user_id
            WHERE pr.token_hash = %s
              AND u.email = %s
              AND pr.used_at IS NULL
        """, (token_hash, email))
        
        reset_req = cur.fetchone()

        if not reset_req:
            raise HTTPException(status_code=400, detail="Invalid or expired reset link")

        if reset_req["expires_at"] < datetime.now():
            raise HTTPException(status_code=400, detail="Reset link has expired")

        is_valid, message = validate_password_strength(data.new_password)
        if not is_valid:
            raise HTTPException(status_code=400, detail=message)

        new_password_hash = hash_password(data.new_password)

        cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_password_hash, reset_req["user_id"]))
        cur.execute("UPDATE password_resets SET used_at = NOW() WHERE id = %s", (reset_req["id"],))
        
        # Invalidate all active sessions for this user for security
        cur.execute("UPDATE sessions SET is_valid = FALSE WHERE user_id = %s", (reset_req["user_id"],))
        
        conn.commit()
        return {"success": True, "message": "Password reset successful. You can now log in with your new password."}
    except HTTPException:
        if conn: conn.rollback()
        raise
    except Exception as e:
        if conn: conn.rollback()
        print(f"Reset password error: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset password")
    finally:
        if cur: cur.close()
        if conn: conn.close()


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
    if data.health_issues is not None:
        updates.append("health_issues=%s")
        values.append(json.dumps(data.health_issues))
    if data.extra_habits is not None:
        updates.append("extra_habits=%s")
        values.append(data.extra_habits)

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


@app.post("/api/analyze-food", response_model=FoodAnalysisResponse)
def analyze_food(req: FoodAnalysisRequest):
    try:
        description = req.description or ""
        
        system_prompt = """You are a certified nutritionist. Analyze the food and provide accurate nutritional information.

PHYSICAL CONSTRAINTS (MANDATORY):
- 1g Protein = 4 kcal
- 1g Carbohydrates = 4 kcal
- 1g Fat = 9 kcal
- The total calories MUST roughly equal (4 * protein) + (4 * carbs) + (9 * fat). 
- Be realistic: for example, 200 kcal of ice cream CANNOT have 60g protein.

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

@app.post("/api/analyze-body", response_model=BodyAnalysisResponse)
def analyze_body(req: BodyAnalysisRequest):
    try:
        system_prompt = """You are an expert physical anthropologist and fitness data scientist.
Analyze the provided body photo to estimate the person's height (in cm) and current weight (in kg).
The user's gender is provided as context.

Return ONLY a valid JSON object with the following schema:
{
  "height": number,
  "weight": number,
  "bmi": number,
  "category": "Underweight" | "Normal" | "Overweight" | "Obese",
  "notes": "string (brief visual observation about posture or frame)"
}

Be as accurate as possible. If the height is difficult to judge, use average height for the gender as a baseline (Male ~175cm, Female ~163cm) and adjust based on limb length and proportions relative to surroundings."""

        user_prompt = f"Gender Context: {req.gender}. Analyze this body profile for nutritional blueprinting."
        
        ai_response = ask_openai_with_image(system_prompt, user_prompt, req.image_base64)
        
        if not ai_response:
             raise HTTPException(status_code=500, detail="Vision AI failed to analyze profile")

        try:
            clean = extract_json_from_response(ai_response)
            if not clean:
                print(f"Body analysis parse error: Empty extracted JSON. Raw: {ai_response[:500]}")
                raise ValueError("Empty response")
                
            data = json.loads(clean)
            
            return BodyAnalysisResponse(
                success=True,
                height=float(data.get("height", 170)),
                weight=float(data.get("weight", 70)),
                bmi=float(data.get("bmi", 24.2)),
                category=data.get("category", "Normal"),
                notes=data.get("notes", "Analysis completed via visual sync.")
            )
        except (json.JSONDecodeError, ValueError) as parse_err:
            print(f"Body analysis parse error: {parse_err}")
            print(f"Raw AI response was: {ai_response[:1000]}")
            raise HTTPException(status_code=500, detail="Failed to parse AI anthropometric output")
            
    except Exception as e:
        print(f"Body analysis error: {e}")
        raise HTTPException(status_code=500, detail="AI Body Analysis failed")

@app.post("/api/upload-food-image")
async def upload_food_image(
    file: UploadFile = File(...),
    description: Optional[str] = Form(None)
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid image type")
    
    data = await file.read()
    b64 = base64.b64encode(data).decode()
    
    return analyze_food(FoodAnalysisRequest(description=description, image_base64=b64))

@app.post("/api/health-chat", response_model=HealthChatResponse)
def health_chat(req: HealthChatRequest):
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

@app.post("/api/diet-plan", response_model=DietPlanResponse)
def generate_diet_plan(req: DietPlanRequest):
    try:
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
        
        if req.gender.lower() == "male":
            bmr = 10 * req.weight + 6.25 * req.height - 5 * req.age + 5
        else:
            bmr = 10 * req.weight + 6.25 * req.height - 5 * req.age - 161
        
        meta_mod = {"fast": 1.1, "normal": 1.0, "slow": 0.9}.get(req.metabolism_type.lower(), 1.0)
        bmr *= meta_mod
        
        activity_mult = {
            "sedentary": 1.2, "light": 1.375, "moderate": 1.55,
            "active": 1.725, "very_active": 1.9
        }.get(req.activity_level.lower(), 1.55)
        
        tdee = bmr * activity_mult
        
        goal_adj = {
            "lose": -500, "lose_fast": -750, "maintain": 0,
            "gain": 300, "gain_muscle": 400
        }.get(req.goal.lower(), 0)
        
        target_cal = max(int(tdee + goal_adj), 1200 if req.gender.lower() == "female" else 1500)
        
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

        restrictions = ", ".join(req.dietary_restrictions) if req.dietary_restrictions else "none"

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

        health_ctx = ""
        if req.health_issues:
            health_ctx = f"\nHEALTH ANALYSIS: The user has the following health issues: {', '.join(req.health_issues)}. "
            health_ctx += "You MUST adjust the meal plan to be safe and beneficial for these conditions. "
            if any(h in req.health_issues for h in ["Diabetes", "diabetes", "Sugar", "High Sugar"]):
                health_ctx += "Strictly prioritize Low Glycemic Index (GI) foods, low sugar, and high fiber. "
            if any(h in req.health_issues for h in ["Hypertension", "bp", "Blood Pressure", "high bp"]):
                health_ctx += "Strictly prioritize Low Sodium (low salt) meals. Avoid processed foods. "
            health_ctx += "\n"

        habit_ctx = ""
        if req.extra_habits:
            habit_ctx = f"\nUSER HABITS & PREFERENCES: {req.extra_habits}. Incorporate these into the plan where appropriate.\n"

        ai_user_prompt = (
            f"Create a 7-day meal plan STRICTLY BASED ON BMI CATEGORY AND HEALTH STATUS.\n\n"
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
            f"Dietary Restrictions: {restrictions}\n"
            f"{health_ctx}"
            f"{habit_ctx}\n"
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
            "HEALTH ANALYSIS RULES:\n"
            "- If user has Diabetes: STRICTLY avoid honey, syrups, white rice, white bread. Use oats, quinoa, brown rice, millets.\n"
            "- If user has Hypertension: Avoid canned foods, pickles, high-salt snacks. Use fresh herbs and lemon for flavor.\n\n"
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
            "- BMI and Health rules must override goal if conflicts arise\n"
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
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO meal_logs (user_id, food_name, calories, protein, carbs, fat, meal_type, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (user["id"], sanitize_input(food_name), calories, round(float(protein), 2), round(float(carbs), 2), round(float(fat), 2), meal_type, notes))
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "message": "Meal logged"}
    except Exception as e:
        print(f"Meal log error: {e}")
        raise HTTPException(status_code=500, detail="Failed to log meal")

@app.get("/api/meals/history")
def get_meal_history(days: int = 7, user=Depends(require_auth)):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT * FROM meal_logs
            WHERE user_id = %s AND logged_at >= NOW() - INTERVAL '1 day' * %s
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
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT id, food_name, calories, protein, carbs, fat, meal_type, notes, logged_at
            FROM meal_logs
            WHERE user_id = %s AND logged_at::DATE = CURRENT_DATE
            ORDER BY logged_at DESC
        """, (user["id"],))
        meals = cur.fetchall()
        cur.close()
        conn.close()
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
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        today = datetime.now().date()
        
        cur.execute("""
            SELECT COALESCE(SUM(calories), 0) as total_calories,
                   COALESCE(SUM(protein), 0) as total_protein,
                   COALESCE(SUM(carbs), 0) as total_carbs,
                   COALESCE(SUM(fat), 0) as total_fat
            FROM meal_logs
            WHERE user_id = %s AND DATE(logged_at) = %s
        """, (user["id"], today))
        today_nutrition = cur.fetchone()
        
        yesterday = today - timedelta(days=1)
        cur.execute("""
            SELECT COALESCE(SUM(calories), 0) as total_calories
            FROM meal_logs
            WHERE user_id = %s AND DATE(logged_at) = %s
        """, (user["id"], yesterday))
        yesterday_nutrition = cur.fetchone()
        
        calorie_trend = 0
        if yesterday_nutrition['total_calories'] > 0:
            calorie_trend = int(((today_nutrition['total_calories'] - yesterday_nutrition['total_calories']) 
                               / yesterday_nutrition['total_calories']) * 100)
        
        cur.execute("""
            SELECT COALESCE(SUM(glasses), 0) as total_glasses
            FROM water_logs
            WHERE user_id = %s AND log_date = %s
        """, (user["id"], today))
        water_data = cur.fetchone()
        
        # Fetch last 7 days with actual date so we can map to correct day names
        cur.execute("""
            SELECT logged_at::DATE as log_date,
                   COALESCE(SUM(calories), 0) as calories
            FROM meal_logs
            WHERE user_id = %s
              AND logged_at::DATE >= CURRENT_DATE - INTERVAL '6 days'
            GROUP BY logged_at::DATE
            ORDER BY logged_at::DATE
        """, (user["id"],))
        raw_weekly = cur.fetchall()

        # Build a complete Mon-Sun 7-day window with 0 for missing days
        from datetime import timedelta as _td
        day_abbr   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        cal_by_date = {str(r["log_date"]): int(r["calories"]) for r in raw_weekly}

        weekly_activity = []
        for i in range(7):
            d = today - _td(days=6 - i)          # oldest → newest
            weekly_activity.append({
                "date":    str(d),
                "day":     day_abbr[d.weekday()], # Mon=0 … Sun=6
                "calories": cal_by_date.get(str(d), 0),
                "is_today": d == today,
            })

        avg_weekly_calories = 0
        filled = [w["calories"] for w in weekly_activity if w["calories"] > 0]
        if filled:
            avg_weekly_calories = int(sum(filled) / len(filled))
        
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
        
        target_calories = 2000
        if user.get('weight') and user.get('height') and user.get('age'):
            if user.get('gender', '').lower() == 'male':
                bmr = 10 * user['weight'] + 6.25 * user['height'] - 5 * user['age'] + 5
            else:
                bmr = 10 * user['weight'] + 6.25 * user['height'] - 5 * user['age'] - 161
            
            activity_mult = {'sedentary': 1.2, 'light': 1.375, 'moderate': 1.55, 
                           'active': 1.725, 'very_active': 1.9}.get(user.get('activity_level', '').lower(), 1.55)
            target_calories = int(bmr * activity_mult)
        
        daily_goal_percentage = min(int((today_nutrition['total_calories'] / target_calories) * 100), 100) if target_calories > 0 else 0
        
        cur.execute("""
            SELECT food_name, calories, meal_type, logged_at
            FROM meal_logs
            WHERE user_id = %s
            ORDER BY logged_at DESC
            LIMIT 5
        """, (user["id"],))
        recent_meals = cur.fetchall()

        # ✅ FIX: Fetch the active weekly_plan so dashboard can pass it to WhatToEatNext
        cur.execute("""
            SELECT weekly_plan FROM diet_plans
            WHERE user_id = %s AND is_active = TRUE
            ORDER BY created_at DESC
            LIMIT 1
        """, (user["id"],))
        plan_row = cur.fetchone()
        weekly_plan = plan_row.get('weekly_plan') if plan_row else None
        if isinstance(weekly_plan, str):
            weekly_plan = json.loads(weekly_plan)
        
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
                "weekly_activity": weekly_activity,
                "macros": {
                    "protein": round(today_nutrition['total_protein'], 1),
                    "carbs": round(today_nutrition['total_carbs'], 1),
                    "fat": round(today_nutrition['total_fat'], 1)
                },
                "recent_meals": recent_meals,
                "weekly_plan": weekly_plan  # ✅ FIX: Include weekly_plan in stats response
            }
        }
        
    except Exception as e:
        print(f"Dashboard stats error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to get dashboard stats: {str(e)}")

@app.post("/api/water/log")
def log_water(glasses: int = 1, user=Depends(require_auth)):
    try:
        conn = get_db()
        cur = conn.cursor()
        today = datetime.now().date()
        
        cur.execute("""
            INSERT INTO water_logs (user_id, glasses, log_date)
            VALUES (%s, %s, %s)
        """, (user["id"], glasses, today))
        
        conn.commit()
        
        cur.execute("""
            SELECT COALESCE(SUM(glasses), 0) as total
            FROM water_logs
            WHERE user_id = %s AND log_date = %s
        """, (user["id"], today))
        
        result = cur.fetchone()

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
            "total_today": total_today
        }

    except Exception as e:
        print(f"Water log error: {e}")
        raise HTTPException(status_code=500, detail="Failed to log water intake")


@app.get("/api/water/today")
def get_water_today(user=Depends(require_auth)):
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

        glasses_today = 0
        if result is not None and result[0] is not None:
            glasses_today = int(result[0])
        else:
            glasses_today = 0
        
        cur.close()
        conn.close()
        
        return {
            "success": True,
            "current": glasses_today,   # field name the frontend expects
            "glasses": glasses_today,   # backwards-compat alias
            "goal":    8,               # field name the frontend expects
            "target":  8,               # backwards-compat alias
        }

    except Exception as e:
        print(f"Water fetch error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get water intake")

@app.post("/api/analyze-food-and-log")
async def analyze_and_log_food(
    request: Request,
    user=Depends(require_auth)
):
    try:
        body = await request.json()
        description = body.get("description", "")
        image_base64 = body.get("image_base64")
        
        if not image_base64 and not description:
            raise HTTPException(status_code=400, detail="Either image or description required")
        
        if image_base64:
            system_prompt = """You are a nutrition expert. Analyze food images accurately.

PHYSICAL CONSTRAINTS:
- 1g Protein = 4 kcal, 1g Carbs = 4 kcal, 1g Fat = 9 kcal.
- Total calories MUST match macros: (4*P + 4*C + 9*F).
- Protein/Fat/Carbs must be realistic for the specific food.

Return a detailed JSON with this EXACT structure (no extra text):
{
  "items": [{"name": "food name", "portion": "serving size", "calories": number, "nutrition": {"protein": g, "carbs": g, "fat": g}}],
  "nutrition": {"calories": total, "protein": grams, "carbs": grams, "fat": grams, "fiber": grams},
  "health_benefits": ["benefit1", "benefit2"],
  "warnings": ["warning1"],
  "healthier_alternatives": ["alternative1"]
}"""
            
            user_prompt = f"Analyze this food image. Description: {description if description else 'analyze what you see'}"
            response_text = ask_openai_with_image(system_prompt, user_prompt, image_base64, max_tokens=1500)
        else:
            system_prompt = """You are a nutrition expert. Provide nutrition data in JSON format only.

PHYSICAL CONSTRAINTS:
- 1g Protein = 4 kcal, 1g Carbs = 4 kcal, 1g Fat = 9 kcal.
- Total calories MUST match macros: (4*P + 4*C + 9*F).
- Protein/Fat/Carbs must be realistic for the food description.

Return this EXACT structure (no extra text):
{
  "items": [{"name": "food name", "portion": "serving size", "calories": number, "nutrition": {"protein": g, "carbs": g, "fat": g}}],
  "nutrition": {"calories": total, "protein": grams, "carbs": grams, "fat": grams, "fiber": grams},
  "health_benefits": ["benefit1"],
  "warnings": ["warning1"],
  "healthier_alternatives": ["alternative1"]
}"""
            response_text = ask_openai(system_prompt, f"Analyze: {description}", max_tokens=1000)
        
        if not response_text:
            raise HTTPException(status_code=500, detail="AI analysis failed")
        
        try:
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
        
        conn = get_db()
        cur = conn.cursor()
        
        cur.execute("""
            INSERT INTO food_analysis_history 
            (user_id, food_items, total_calories, total_protein, total_carbs, total_fat, total_fiber)
            VALUES (%s, %s::jsonb, %s, %s, %s, %s, %s)
        """, (
            user["id"],
            json.dumps(data.get("items", [])),
            data.get("nutrition", {}).get("calories", 0),
            round(float(data.get("nutrition", {}).get("protein", 0)), 2),
            round(float(data.get("nutrition", {}).get("carbs", 0)), 2),
            round(float(data.get("nutrition", {}).get("fat", 0)), 2),
            round(float(data.get("nutrition", {}).get("fiber", 0)), 2)
        ))
        
        for item in data.get("items", []):
            item_nutrition = item.get("nutrition") or {}
            item_cals = item.get("calories", 0)
            total_cals = data.get("nutrition", {}).get("calories", 1)
            
            # If item-specific nutrition is missing, distribute total nutrition proportionally by calories
            def get_proportional(macro_key):
                if macro_key in item_nutrition:
                    return round(float(item_nutrition[macro_key]), 2)
                total_val = float(data.get("nutrition", {}).get(macro_key, 0))
                return round((total_val * item_cals) / max(1, total_cals), 2)

            cur.execute("""
                INSERT INTO meal_logs (user_id, food_name, calories, protein, carbs, fat, meal_type)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                user["id"],
                item.get("name", "Unknown"),
                item_cals,
                get_proportional("protein"),
                get_proportional("carbs"),
                get_proportional("fat"),
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

@app.get("/api/profile")
def get_profile(user=Depends(require_auth)):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT id, email, name, gender, age, height, weight,
                   activity_level, metabolism_type, goal, created_at,
                   profile_image, health_issues, extra_habits
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


@app.post("/api/profile/image")
async def upload_profile_image(
    file: UploadFile = File(...),
    user=Depends(require_auth)
):
    """Upload, resize, compress, and save a profile photo as a base64 data URL."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (JPG, PNG, GIF, or WebP)")

    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:   # hard reject at 10 MB before even touching Pillow
        raise HTTPException(status_code=413, detail="Image must be under 10 MB")

    # ── Resize + compress with Pillow so the stored data URL stays small ──
    try:
        from PIL import Image as PILImage
        import io as _io

        img = PILImage.open(_io.BytesIO(raw))

        # Convert palette/transparency modes to RGB for JPEG compatibility
        if img.mode in ("RGBA", "P", "LA"):
            bg = PILImage.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            bg.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")

        # Resize to max 400×400 avatar size (preserves aspect ratio)
        max_dim = 400
        img.thumbnail((max_dim, max_dim), PILImage.LANCZOS)

        # Compress to JPEG at quality=75 (~15-40 KB for most photos)
        buf = _io.BytesIO()
        img.save(buf, format="JPEG", quality=75, optimize=True)
        compressed = buf.getvalue()

        data_url = f"data:image/jpeg;base64,{base64.b64encode(compressed).decode()}"

    except ImportError:
        # Pillow not installed — fall back to raw encoding (may be large)
        data_url = f"data:{file.content_type};base64,{base64.b64encode(raw).decode()}"
    except Exception as img_err:
        raise HTTPException(status_code=422, detail=f"Could not process image: {str(img_err)}")

    # ── Ensure column is MEDIUMTEXT (safe to run every time, MySQL ignores no-ops) ──
    conn = get_db()
    cur = conn.cursor()
    try:
        try:
            cur.execute("ALTER TABLE users MODIFY COLUMN profile_image MEDIUMTEXT")
            conn.commit()
        except Exception:
            pass  # already MEDIUMTEXT or ALTER not permitted — proceed anyway

        cur.execute("UPDATE users SET profile_image = %s WHERE id = %s", (data_url, user["id"]))
        conn.commit()
        return {"success": True, "profile_image": data_url}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save image: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.delete("/api/profile/image")
def delete_profile_image(user=Depends(require_auth)):
    """Remove the user's profile photo."""
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("UPDATE users SET profile_image = NULL WHERE id = %s", (user["id"],))
        conn.commit()
        return {"success": True}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to remove image: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.put("/api/profile")
async def update_profile_full(request: Request, user=Depends(require_auth)):
    try:
        body = await request.json()
        
        conn = get_db()
        cur = conn.cursor()
        
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


class WaterAdjustRequest(BaseModel):
    adjustment: int  # +1 or -1

@app.post("/api/water/adjust")
async def adjust_water_intake(
    request: dict,
    user: dict = Depends(require_auth)
):
    """Adjust water intake by +1 or -1 glass"""
    try:
        adjustment = request.get("adjustment")
        if adjustment not in [-1, 1]:
            raise HTTPException(status_code=400, detail="Adjustment must be +1 or -1")
        
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        today = date.today()
        
        cur.execute("""
            SELECT COALESCE(SUM(glasses), 0) as current_total
            FROM water_logs
            WHERE user_id = %s AND log_date = %s
        """, (user['id'], today))
        
        result = cur.fetchone()
        current_total = int(result['current_total']) if result else 0
        
        new_total = current_total + adjustment
        
        if new_total < 0:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail="Water intake cannot be negative")
        
        if adjustment > 0:
            cur.execute("""
                INSERT INTO water_logs (user_id, glasses, log_date, logged_at)
                VALUES (%s, 1, %s, NOW())
            """, (user['id'], today))
        
        elif adjustment < 0 and current_total > 0:
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


@app.post("/api/water/set-goal")
async def set_water_goal(request: dict, user: dict = Depends(require_auth)):
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
    try:
        if days < 1 or days > 30:
            raise HTTPException(status_code=400, detail="Days must be between 1 and 30")
        
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
        
        cur.close()
        conn.close()
        
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


@app.post("/api/diet-plan/save")
def save_diet_plan(
    plan_data: dict,
    user=Depends(require_auth)
):
    from datetime import date as date_module, timedelta as timedelta_module
    
    conn = get_db()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS diet_plans (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                plan_name VARCHAR(255) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                target_calories INT NOT NULL,
                target_protein DECIMAL(10,2) DEFAULT 0,
                target_carbs DECIMAL(10,2) DEFAULT 0,
                target_fat DECIMAL(10,2) DEFAULT 0,
                weekly_plan JSONB,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        
        cur.execute("""
            UPDATE diet_plans 
            SET is_active = FALSE
            WHERE user_id = %s
        """, (user["id"],))
        
        today = date_module.today()
        cur.execute("""
            INSERT INTO diet_plans (
                user_id, plan_name, start_date, end_date,
                target_calories, target_protein, target_carbs, target_fat,
                weekly_plan, is_active
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, TRUE)
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


# =========================
# DIET PLAN NEXT MEAL ENDPOINT
# =========================
@app.get("/api/diet-plan/next-meal")
def get_next_meal(user=Depends(require_auth)):
    """Get the next meal based on current time and diet plan"""
    from datetime import datetime as datetime_module, time as time_module
    
    now = datetime_module.now()
    current_time = now.time()
    current_day = now.strftime("%A")
    
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute("""
            SELECT * FROM diet_plans
            WHERE user_id = %s 
            AND is_active = TRUE
            AND start_date <= CURRENT_DATE
            AND end_date >= CURRENT_DATE
            ORDER BY created_at DESC
            LIMIT 1
        """, (user["id"],))
        
        plan = cur.fetchone()
        
        if not plan:
            cur.close()
            conn.close()
            return {"success": False, "message": "No active diet plan"}
        
        weekly_plan = plan['weekly_plan']
        if isinstance(weekly_plan, str):
            weekly_plan = json.loads(weekly_plan)
        
        # Find today's plan
        today_plan = None
        for day_data in weekly_plan:
            if day_data['day'] == current_day:
                today_plan = day_data
                break
        
        if not today_plan:
            return {"success": False, "message": "No plan for today"}
        
        # Define meal times
        # Ordered schedule: (snake_key, label_in_meals_array, meal_time)
        meal_schedule = [
            ("breakfast",       "Breakfast",       time_module(7, 0)),
            ("morning_snack",   "Morning Snack",   time_module(10, 0)),
            ("lunch",           "Lunch",           time_module(12, 30)),
            ("afternoon_snack", "Afternoon Snack", time_module(15, 30)),
            ("dinner",          "Dinner",          time_module(19, 0)),
        ]

        # The frontend saves meals as an ARRAY inside today_plan["meals"]:
        #   [{"meal": "Breakfast", "dish": "...", "foods": [...], ...}, ...]
        # Build a normalised lookup keyed by snake_case type so we handle
        # both the current array format and any legacy direct-key format.
        meal_lookup: dict = {}

        raw_meals = today_plan.get("meals")
        if isinstance(raw_meals, list):
            # Current format: frontend saves meals as an ordered list
            label_to_key = {label.lower(): key for key, label, _ in meal_schedule}
            for m in raw_meals:
                label = m.get("meal", "").strip().lower()
                key = label_to_key.get(label)
                if key:
                    meal_lookup[key] = {
                        "dish":     m.get("dish") or m.get("name", "Healthy Meal"),
                        "foods":    m.get("foods") or m.get("ingredients", []),
                        "calories": m.get("calories", 0),
                        "protein":  m.get("protein", 0),
                        "carbs":    m.get("carbs", 0),
                        "fat":      m.get("fat", 0),
                    }
        else:
            # Legacy format: meals stored as direct keys on the day object
            for key, _label, _ in meal_schedule:
                raw = today_plan.get(key)
                if isinstance(raw, dict):
                    meal_lookup[key] = {
                        "dish":     raw.get("name", "Healthy Meal"),
                        "foods":    raw.get("ingredients", []),
                        "calories": raw.get("calories", 0),
                        "protein":  raw.get("protein", 0),
                        "carbs":    raw.get("carbs", 0),
                        "fat":      raw.get("fat", 0),
                    }

        # Find the next upcoming meal.
        # IMPORTANT: break is INSIDE "if meal_data" so if a time slot has no
        # data in the lookup we continue to the next slot instead of stopping.
        next_meal = None
        for meal_type, _label, meal_time in meal_schedule:
            if current_time < meal_time:
                meal_data = meal_lookup.get(meal_type)
                if meal_data:
                    next_meal = {
                        "type":        meal_type,
                        "time":        meal_time.strftime("%I:%M %p"),
                        "dish":        meal_data["dish"],
                        "foods":       meal_data["foods"],
                        "calories":    meal_data["calories"],
                        "protein":     meal_data["protein"],
                        "carbs":       meal_data["carbs"],
                        "fat":         meal_data["fat"],
                        "is_tomorrow": False,
                    }
                    break   # ← break only after successfully finding a meal
                # if no data for this time slot, continue to the next meal

        # After dinner (or if no slot matched), fall forward to tomorrow's breakfast
        # so the widget always shows something useful.
        if not next_meal:
            bfast = meal_lookup.get("breakfast")
            if bfast:
                next_meal = {
                    "type":        "breakfast",
                    "time":        "07:00 AM",
                    "dish":        bfast["dish"],
                    "foods":       bfast["foods"],
                    "calories":    bfast["calories"],
                    "protein":     bfast["protein"],
                    "carbs":       bfast["carbs"],
                    "fat":         bfast["fat"],
                    "is_tomorrow": True,
                }

        if next_meal:
            # ── ADAPTIVE CALORIE BALANCING ──
            # 1. Fetch actual intake today
            cur.execute("SELECT SUM(calories) as total FROM meal_logs WHERE user_id = %s AND logged_at::DATE = CURRENT_DATE", (user["id"],))
            actual_today = cur.fetchone().get("total") or 0
            
            # 2. Calculate planned intake so far
            planned_so_far = 0
            for m_type, _, m_time in meal_schedule:
                if current_time > m_time:
                    planned_so_far += meal_lookup.get(m_type, {}).get("calories", 0)
            
            # 3. Handle heavy night for morning breakfast
            if next_meal["type"] == "breakfast":
                cur.execute("""
                    SELECT SUM(calories) as total 
                    FROM meal_logs 
                    WHERE user_id = %s 
                      AND logged_at >= NOW() - INTERVAL '12 hours'
                      AND EXTRACT(HOUR FROM logged_at) >= 20
                """, (user["id"],))
                heavy_night_cal = cur.fetchone().get("total") or 0
                if heavy_night_cal > 800:
                    next_meal["calories"] = int(next_meal["calories"] * 0.7)
                    next_meal["is_adaptive"] = True
                    next_meal["reason"] = "Adjusted for a heavy meal late last night."
                    next_meal["dish"] = f"Light {next_meal['dish']}"

            # 4. Intra-day balancing
            over_budget = actual_today - planned_so_far
            if over_budget > 150 and not next_meal.get("is_adaptive"):
                reduction = min(0.4, over_budget / 1000) # Max 40% reduction
                next_meal["calories"] = int(next_meal["calories"] * (1 - reduction))
                next_meal["is_adaptive"] = True
                next_meal["reason"] = f"Adjusted because you're {int(over_budget)} kcal over your planned budget today."
                
                if over_budget > 300:
                    ai_prompt = f"Suggest a lighter version of '{next_meal['dish']}' that is around {next_meal['calories']} kcal. Just the name."
                    lighter_dish = ask_openai("You are a nutritionist.", ai_prompt, max_tokens=20)
                    if lighter_dish and "Error" not in lighter_dish:
                        next_meal["dish"] = lighter_dish.strip().replace('"', '')

            cur.close()
            conn.close()
            return {"success": True, "next_meal": next_meal}
        else:
            cur.close()
            conn.close()
            return {"success": False, "message": "No diet plan meals found for today"}
            
    except Exception as e:
        if 'cur' in locals():
            try: cur.close()
            except: pass
        if 'conn' in locals():
            try: conn.close()
            except: pass
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/auth/google")
async def google_login(request: dict, req: Request):
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

        # ── Telegram: notify admin only for brand new Google users ──────────
        if is_new:
            notify_new_user_google(
                user_id=user.get("id", 0),
                name=user.get("name", "Unknown"),
                email=user.get("email", ""),
                profile_image=user.get("profile_image"),
                ip=ip_address,
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


@app.get("/api/subscription/plans")
async def get_subscription_plans():
    try:
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

        plans = subscription_service.get_all_plans()
        return plans

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/subscription/my-subscription")
async def get_my_subscription(user: dict = Depends(require_auth)):
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
    try:
        rzp_key = (os.getenv("RAZORPAY_KEY_ID") or "").strip()
        rzp_secret = (os.getenv("RAZORPAY_KEY_SECRET") or "").strip()
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

        conn = get_db()
        cur = conn.cursor()
        try:
            cur.execute("""
                INSERT INTO payment_transactions
                (user_id, plan_id, amount, currency, payment_status,
                 payment_method, transaction_id, gateway_response, created_at)
                VALUES (%s, %s, %s, 'INR', 'pending', 'razorpay_order', %s, %s::jsonb, NOW())
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
    return await create_subscription_route(request, user)


@app.post("/api/subscription/callback")
async def payment_callback(request: Request):
    form_data = await request.form()
    rzp_payment_id = form_data.get("razorpay_payment_id")
    rzp_order_id = form_data.get("razorpay_order_id")
    rzp_signature = form_data.get("razorpay_signature")
    error_code = form_data.get("error[code]")
    error_description = form_data.get("error[description]")
    
    frontend_url = os.getenv("FRONTEND_URL", "https://nutrilife-h6uwverce.app")
        
    if error_code:
        reason = urllib.parse.quote(str(error_description or "Payment failed or cancelled"))
        return RedirectResponse(url=f"{frontend_url}/subscription?payment=failed&reason={reason}", status_code=303)
        
    if not all([rzp_payment_id, rzp_signature, rzp_order_id]):
        return RedirectResponse(url=f"{frontend_url}/subscription?payment=failed&reason=MissingData", status_code=303)

    try:
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": rzp_order_id,
            "razorpay_payment_id": rzp_payment_id,
            "razorpay_signature": rzp_signature
        })
    except Exception:
        return RedirectResponse(url=f"{frontend_url}/subscription?payment=failed&reason=SignatureMismatch", status_code=303)

    try:
        conn = get_db()
        cur = conn.cursor()
        try:
            cur.execute("""
                SELECT user_id, plan_id FROM payment_transactions
                WHERE transaction_id = %s
            """, (rzp_order_id,))
            txn = cur.fetchone()
            if not txn:
                return RedirectResponse(url=f"{frontend_url}/subscription?payment=failed&reason=OrderNotFound", status_code=303)
                
            user_id = txn[0]
            plan_id = txn[1]
            
            plans = await get_subscription_plans()
            plan = next((p for p in plans if p["id"] == plan_id), None)
            duration_months = plan["duration_months"] if plan else 1
            
            start_date = datetime.now()
            end_date = start_date + timedelta(days=duration_months * 30)
            
            cur.execute("SELECT id FROM user_subscriptions WHERE user_id=%s AND status='active'", (user_id,))
            if cur.fetchone():
                return RedirectResponse(url=f"{frontend_url}/subscription?payment=success", status_code=303)

            cur.execute("""
                INSERT INTO user_subscriptions
                (user_id, plan_id, status, start_date, end_date, created_at)
                VALUES (%s, %s, 'active', %s, %s, NOW())
                RETURNING id
            """, (user_id, plan_id, start_date, end_date))
            
            sub_id = cur.fetchone()[0]
            
            cur.execute("""
                UPDATE payment_transactions
                SET payment_status='completed',
                    subscription_id=%s,
                    gateway_response=%s::jsonb,
                    updated_at=NOW()
                WHERE transaction_id=%s
            """, (
                sub_id,
                json.dumps({"razorpay_payment_id": rzp_payment_id, "razorpay_order_id": rzp_order_id}),
                rzp_order_id
            ))
            
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
            """, (rzp_order_id, rzp_payment_id, start_date, end_date, end_date, user_id))
            
            conn.commit()
            
        finally:
            cur.close()
            conn.close()
            
        return RedirectResponse(url=f"{frontend_url}/subscription?payment=success", status_code=303)
    except Exception as e:
        print(f"Callback error: {e}")
        return RedirectResponse(url=f"{frontend_url}/subscription?payment=failed&reason=ServerError", status_code=303)


@app.post("/api/subscription/verify-payment")
async def verify_payment(data: dict, user: dict = Depends(require_auth)):
    try:
        rzp_payment_id = data.get("razorpay_payment_id")
        rzp_sub_id = data.get("razorpay_subscription_id")
        rzp_signature = data.get("razorpay_signature")
        plan_id = data.get("plan_id")

        rzp_order_id = data.get("razorpay_order_id")

        if not all([rzp_payment_id, rzp_signature, rzp_order_id]):
            raise HTTPException(status_code=400, detail="Missing payment verification fields (need razorpay_payment_id, razorpay_order_id, razorpay_signature)")

        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": rzp_order_id,
            "razorpay_payment_id": rzp_payment_id,
            "razorpay_signature": rzp_signature
        })

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Payment signature verification failed")

    try:
        plans = await get_subscription_plans()
        plan = next((p for p in plans if p["id"] == plan_id), None)
        duration_months = plan["duration_months"] if plan else 1

        start_date = datetime.now()
        end_date = start_date + timedelta(days=duration_months * 30)

        conn = get_db()
        cur = conn.cursor()
        try:
            cur.execute("""
                INSERT INTO user_subscriptions
                (user_id, plan_id, status, start_date, end_date, created_at)
                VALUES (%s, %s, 'active', %s, %s, NOW())
                RETURNING id
            """, (user["id"], plan_id, start_date, end_date))

            sub_id = cur.fetchone()[0]

            cur.execute("""
                UPDATE payment_transactions
                SET payment_status='completed',
                    subscription_id=%s,
                    gateway_response=%s::jsonb,
                    updated_at=NOW()
                WHERE transaction_id=%s
            """, (
                sub_id,
                json.dumps({"razorpay_payment_id": rzp_payment_id,
                            "razorpay_order_id": rzp_order_id}),
                rzp_order_id
            ))

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
    if not subscription_middleware:
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


import hmac
import hashlib

@app.post("/api/webhook/razorpay")
async def razorpay_webhook(request: Request):
    webhook_secret = (os.getenv("RAZORPAY_WEBHOOK_SECRET") or "").strip()
    if not webhook_secret:
        # Webhook secret not configured — skip signature verification but still process
        print("⚠ RAZORPAY_WEBHOOK_SECRET not set — webhook signature verification skipped")
        body_bytes = await request.body()
        try:
            payload = json.loads(body_bytes)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON payload")
        return {"status": "ok", "warning": "webhook_secret_not_configured"}

    body_bytes = await request.body()
    received_sig = request.headers.get("X-Razorpay-Signature", "")

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

    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "SELECT id FROM razorpay_webhook_events WHERE event_id = %s",
            (event_id,)
        )
        already_done = cur.fetchone()
        if already_done:
            cur.close()
            conn.close()
            return {"status": "already_processed"}

        cur.execute(
            """INSERT INTO razorpay_webhook_events
               (event_id, event_type, payload, processed, created_at)
               VALUES (%s, %s, %s::jsonb, FALSE, NOW())""",
            (event_id, event_type, json.dumps(payload))
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as db_err:
        print(f"Webhook DB log error: {db_err}")

    try:
        if event_type in ("subscription.activated", "subscription.charged"):
            await _webhook_activate_subscription(payload)

        elif event_type == "subscription.cancelled":
            await _webhook_cancel_subscription(payload)

        elif event_type == "payment.failed":
            await _webhook_payment_failed(payload)

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
    sub_data = payload.get("payload", {}).get("subscription", {}).get("entity", {})
    payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})

    rzp_sub_id = sub_data.get("id")
    rzp_payment_id = payment_entity.get("id", "")
    notes = sub_data.get("notes", {})
    user_id = notes.get("user_id")
    plan_id = notes.get("plan_id")

    if not rzp_sub_id:
        return

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
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
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

        if plan_id:
            cur.execute("""
                INSERT INTO user_subscriptions
                (user_id, plan_id, status, start_date, end_date, created_at)
                VALUES (%s, %s, 'active', %s, %s, NOW())
            """, (user_id, plan_id, start_date, end_date))

        conn.commit()

        # ── Telegram: notify admin of new subscription ─────────────────────
        try:
            cur2 = conn.cursor(cursor_factory=RealDictCursor)
            cur2.execute("SELECT name, email FROM users WHERE id = %s", (user_id,))
            u = cur2.fetchone()
            cur2.close()
            if u:
                notify_new_subscription(
                    user_id=user_id,
                    name=u.get('name', 'Unknown'),
                    email=u.get('email', ''),
                    plan=f'{duration_months}-Month Plan',
                    amount=0,
                    transaction_id=rzp_payment_id or rzp_sub_id,
                )
        except Exception as _notify_err:
            print(f'[Telegram] Subscription notify error: {_notify_err}')
        print(f"Webhook: activated subscription {rzp_sub_id} for user {user_id}")
    finally:
        cur.close()
        conn.close()


async def _webhook_cancel_subscription(payload: dict):
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
    payment_data = payload.get("payload", {}).get("payment", {}).get("entity", {})
    description = payment_data.get("description", "")
    rzp_payment_id = payment_data.get("id", "")

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


@app.post("/api/meals/log-batch")
async def log_meal_batch(req: BatchLogRequest, user=Depends(require_auth)):
    conn = None
    cur = None
    try:
        conn = get_db()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO food_analysis_history
            (user_id, food_items, total_calories, total_protein, total_carbs, total_fat, total_fiber)
            VALUES (%s, %s::jsonb, %s, %s, %s, %s, %s)
        """, (
            user["id"],
            json.dumps(req.items),
            req.nutrition.get("calories", 0),
            round(float(req.nutrition.get("protein", 0)), 2),
            round(float(req.nutrition.get("carbs", 0)), 2),
            round(float(req.nutrition.get("fat", 0)), 2),
            round(float(req.nutrition.get("fiber", 0)), 2),
        ))

        items_logged = 0
        total_batch_calories = req.nutrition.get("calories", 1)
        
        for item in req.items:
            item_cals = item.get("calories", 0)
            item_nutrition = item.get("nutrition") or {}
            
            # Use item-specific macros if available, otherwise distribute total proportionally by calories
            def get_item_macro(key):
                if key in item_nutrition:
                    return round(float(item_nutrition[key]), 2)
                total_macro = float(req.nutrition.get(key, 0))
                return round((total_macro * item_cals) / max(1, total_batch_calories), 2)

            cur.execute("""
                INSERT INTO meal_logs (user_id, food_name, calories, protein, carbs, fat, meal_type)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                user["id"],
                sanitize_input(item.get("name", "Unknown Food"), 200),
                item_cals,
                get_item_macro("protein"),
                get_item_macro("carbs"),
                get_item_macro("fat"),
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


@app.get("/api/fasting/plans")
def get_fasting_plans():
    return {"success": True, "plans": list(FASTING_PLANS.values())}


@app.get("/api/fasting/my-plan")
def get_my_fasting_plan(user=Depends(require_auth)):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
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
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT id FROM fasting_sessions
            WHERE user_id = %s AND end_time IS NULL
        """, (user["id"],))
        active = cur.fetchone()
        if active:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail="You already have an active fasting session.")

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
            RETURNING id
        """, (user["id"], plan_id, now, target_end))
        conn.commit()
        session_id = cur.fetchone()['id']
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
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)

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
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)

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
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT id, plan_type, start_time, end_time, target_end_time, completed, created_at
            FROM fasting_sessions
            WHERE user_id = %s
              AND start_time >= NOW() - INTERVAL '1 day' * %s
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


print("=" * 60)
print("✓ NutriLife API initialized successfully")
print("=" * 60)
print(f"✓ Database connection: {'Available' if db_pool else 'Not configured'}")
print(f"✓ Google OAuth: {'Enabled' if google_auth_service else 'Disabled (optional)'}")
print(f"✓ Subscription system: {'Enabled' if subscription_service else 'Disabled (optional)'}")
print(f"✓ API Documentation: http://localhost:8000/docs")
print("=" * 60)
