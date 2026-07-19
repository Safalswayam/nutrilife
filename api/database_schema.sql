-- ============================================
-- NUTRILIFE - POSTGRESQL DATABASE SCHEMA
-- ============================================
-- Self-contained: creates base tables + subscription system.
-- Loaded automatically by docker-compose via /docker-entrypoint-initdb.d.
-- The app's init_database() is idempotent (CREATE TABLE IF NOT EXISTS),
-- so running both is safe.

-- ============================================
-- 1. BASE TABLES
-- ============================================

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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP,
    -- auth / profile extensions
    google_id VARCHAR(255) UNIQUE,
    profile_image TEXT,
    auth_provider VARCHAR(50) DEFAULT 'email',
    email_verified BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified_at TIMESTAMP NULL,
    -- subscription extensions
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    subscription_expires_at TIMESTAMP,
    subscription_status VARCHAR(50) CHECK (subscription_status IN ('inactive','active','cancelled')) NOT NULL DEFAULT 'inactive',
    razorpay_customer_id VARCHAR(255),
    razorpay_subscription_id VARCHAR(255) UNIQUE,
    payment_id VARCHAR(255),
    subscription_start_date TIMESTAMP,
    subscription_end_date TIMESTAMP,
    -- preferences
    fasting_plan VARCHAR(50) DEFAULT 'none',
    daily_water_goal INT DEFAULT 8,
    health_issues TEXT,
    extra_habits TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_valid BOOLEAN DEFAULT TRUE,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_verifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_email_verifications_active ON email_verifications(user_id, used_at, expires_at);

CREATE TABLE IF NOT EXISTS password_resets (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meal_logs (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_name VARCHAR(200) NOT NULL,
    calories INT,
    protein FLOAT,
    carbs FLOAT,
    fat FLOAT,
    meal_type VARCHAR(50),
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_meal_logs_user_date ON meal_logs(user_id, logged_at);

CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saved_diet_plans (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_data JSONB NOT NULL,
    name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS water_logs (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    glasses INT DEFAULT 1,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    log_date DATE NOT NULL,
    daily_goal INT DEFAULT 8
);

CREATE INDEX IF NOT EXISTS idx_water_logs_user_date ON water_logs(user_id, log_date);

CREATE TABLE IF NOT EXISTS daily_stats (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stat_date DATE NOT NULL,
    total_calories INT DEFAULT 0,
    total_protein FLOAT DEFAULT 0,
    total_carbs FLOAT DEFAULT 0,
    total_fat FLOAT DEFAULT 0,
    total_fiber FLOAT DEFAULT 0,
    water_glasses INT DEFAULT 0,
    weight FLOAT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, stat_date)
);

CREATE TABLE IF NOT EXISTS food_analysis_history (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_items JSONB NOT NULL,
    total_calories INT,
    total_protein FLOAT,
    total_carbs FLOAT,
    total_fat FLOAT,
    total_fiber FLOAT,
    image_url VARCHAR(500),
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS diet_plans (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fasting_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_type VARCHAR(50) NOT NULL DEFAULT 'none',
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    target_end_time TIMESTAMP,
    completed BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. SUBSCRIPTION PLANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    duration_months INT NOT NULL UNIQUE,
    base_price DECIMAL(10, 2) NOT NULL,
    final_price DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    features JSONB,
    badge VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plans_active ON subscription_plans(is_active);

-- Insert default plans
INSERT INTO subscription_plans (name, duration_months, base_price, final_price, discount_amount, badge, features) VALUES
('3 Month Plan', 3, 299.00, 299.00, 0.00, NULL,
 '["AI Food Analyzer", "Diet Planner", "Advanced Analytics", "Priority Support"]'::jsonb),
('6 Month Plan', 6, 598.00, 549.00, 49.00, '⭐ Popular',
 '["AI Food Analyzer", "Diet Planner", "Advanced Analytics", "Priority Support", "Save ₹49"]'::jsonb),
('1 Year Plan', 12, 1196.00, 849.00, 347.00, '🔥 Best Value',
 '["AI Food Analyzer", "Diet Planner", "Advanced Analytics", "Priority Support", "Save ₹347", "Best Value"]'::jsonb)
ON CONFLICT (duration_months) DO UPDATE SET updated_at = CURRENT_TIMESTAMP;

-- ============================================
-- 3. USER SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id INT NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(50) CHECK (status IN ('active', 'expired', 'cancelled', 'pending')) DEFAULT 'pending',
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    auto_renew BOOLEAN DEFAULT FALSE,
    cancelled_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_status ON user_subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_end_date ON user_subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_status ON user_subscriptions(status);
-- Composite carried over from the MySQL schema: serves the
-- (user_id, status) + end_date lookups the expiry sweep and status checks do.
CREATE INDEX IF NOT EXISTS idx_subscription_user_status ON user_subscriptions(user_id, status, end_date);

-- ============================================
-- 4. PAYMENT TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payment_transactions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id INT REFERENCES user_subscriptions(id) ON DELETE SET NULL,
    plan_id INT NOT NULL REFERENCES subscription_plans(id),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    payment_status VARCHAR(50) CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
    payment_method VARCHAR(50),
    transaction_id VARCHAR(255) UNIQUE,
    payment_gateway VARCHAR(50),
    gateway_response JSONB,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_status ON payment_transactions(payment_status);
-- Composite carried over from the MySQL schema: per-user payment history
-- filtered by status resolves in a single index scan.
CREATE INDEX IF NOT EXISTS idx_payment_user_status ON payment_transactions(user_id, payment_status);

-- ============================================
-- 5. FEATURE ACCESS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS feature_access (
    id SERIAL PRIMARY KEY,
    feature_name VARCHAR(100) NOT NULL UNIQUE,
    requires_premium BOOLEAN DEFAULT TRUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO feature_access (feature_name, requires_premium, description) VALUES
('food_analyzer', TRUE, 'AI-powered food image analysis'),
('diet_planner', FALSE, 'AI-generated personalized meal plans'),
('advanced_analytics', TRUE, 'Detailed nutritional analytics and insights'),
('water_tracker', FALSE, 'Basic water intake tracking'),
('calorie_tracking', FALSE, 'Manual calorie tracking'),
('dashboard', FALSE, 'Basic dashboard view')
ON CONFLICT (feature_name) DO NOTHING;

-- ============================================
-- 6. AUDIT LOG TABLE (for subscription changes)
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_audit_log (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id INT,
    action VARCHAR(50) NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    details JSONB,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_action ON subscription_audit_log(user_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON subscription_audit_log(created_at);

-- ============================================
-- 7. RAZORPAY WEBHOOK EVENTS LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS razorpay_webhook_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_event_type ON razorpay_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_processed ON razorpay_webhook_events(processed);

-- ============================================
-- 8. INDEXES ON USERS
-- ============================================
CREATE INDEX IF NOT EXISTS idx_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_subscription_status ON users(is_premium, subscription_expires_at);
CREATE INDEX IF NOT EXISTS idx_razorpay_sub_id ON users(razorpay_subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_status ON users(subscription_status);

-- ============================================
-- 9. USEFUL VIEWS
-- ============================================

-- View for active premium users
CREATE OR REPLACE VIEW active_premium_users AS
SELECT
    u.id,
    u.email,
    u.name,
    u.is_premium,
    us.plan_id,
    sp.name AS plan_name,
    us.start_date,
    us.end_date,
    EXTRACT(DAY FROM us.end_date - NOW())::INT AS days_remaining
FROM users u
INNER JOIN user_subscriptions us ON u.id = us.user_id
INNER JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE us.status = 'active'
AND us.end_date > NOW();

-- View for subscription revenue
CREATE OR REPLACE VIEW subscription_revenue AS
SELECT
    to_char(created_at, 'YYYY-MM') AS month,
    COUNT(*) AS total_transactions,
    SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END) AS revenue,
    SUM(CASE WHEN payment_status = 'completed' THEN 1 ELSE 0 END) AS successful_payments,
    SUM(CASE WHEN payment_status = 'failed' THEN 1 ELSE 0 END) AS failed_payments
FROM payment_transactions
GROUP BY to_char(created_at, 'YYYY-MM')
ORDER BY month DESC;

-- ============================================
-- 10. MAINTENANCE FUNCTION
-- ============================================
-- Replaces the MySQL expire_subscriptions() procedure + event scheduler.
-- Run manually or from a cron job: SELECT expire_subscriptions();

CREATE OR REPLACE FUNCTION expire_subscriptions() RETURNS void AS $$
BEGIN
    UPDATE user_subscriptions
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active'
      AND end_date <= NOW();

    -- Sync the denormalized flags on users. Aggregating first keeps this
    -- deterministic when a user has more than one active subscription, and
    -- the IS DISTINCT FROM guard limits writes to rows that actually change
    -- instead of rewriting every user row on every sweep.
    UPDATE users u
    SET is_premium = agg.still_active,
        subscription_expires_at = agg.latest_end
    FROM (
        SELECT u2.id AS user_id,
               COALESCE(bool_or(us.status = 'active' AND us.end_date > NOW()), FALSE) AS still_active,
               MAX(us.end_date) FILTER (WHERE us.status = 'active') AS latest_end
        FROM users u2
        LEFT JOIN user_subscriptions us ON us.user_id = u2.id
        GROUP BY u2.id
    ) agg
    WHERE u.id = agg.user_id
      AND (u.is_premium IS DISTINCT FROM agg.still_active
           OR u.subscription_expires_at IS DISTINCT FROM agg.latest_end);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SETUP COMPLETE
-- ============================================
