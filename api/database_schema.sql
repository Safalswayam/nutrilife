-- ============================================
-- ENHANCED NUTRITION APP - DATABASE SCHEMA
-- ============================================
-- This file contains all new tables for the subscription system
-- Run this after your existing schema

-- ============================================
-- 1. SUBSCRIPTION PLANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    duration_months INT NOT NULL,
    base_price DECIMAL(10, 2) NOT NULL,
    final_price DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    features JSON,
    badge VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active (is_active),
    UNIQUE KEY unique_duration (duration_months)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default plans
INSERT INTO subscription_plans (name, duration_months, base_price, final_price, discount_amount, badge, features) VALUES
('3 Month Plan', 3, 299.00, 299.00, 0.00, NULL, 
 JSON_ARRAY('AI Food Analyzer', 'Diet Planner', 'Advanced Analytics', 'Priority Support')),
('6 Month Plan', 6, 598.00, 549.00, 49.00, '⭐ Popular', 
 JSON_ARRAY('AI Food Analyzer', 'Diet Planner', 'Advanced Analytics', 'Priority Support', 'Save ₹49')),
('1 Year Plan', 12, 1196.00, 849.00, 347.00, '🔥 Best Value', 
 JSON_ARRAY('AI Food Analyzer', 'Diet Planner', 'Advanced Analytics', 'Priority Support', 'Save ₹347', 'Best Value'))
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- ============================================
-- 2. USER SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    plan_id INT NOT NULL,
    status ENUM('active', 'expired', 'cancelled', 'pending') DEFAULT 'pending',
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    auto_renew BOOLEAN DEFAULT FALSE,
    cancelled_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
    INDEX idx_user_status (user_id, status),
    INDEX idx_end_date (end_date),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. PAYMENT TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payment_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    subscription_id INT,
    plan_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    payment_status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
    payment_method VARCHAR(50),
    transaction_id VARCHAR(255) UNIQUE,
    payment_gateway VARCHAR(50),
    gateway_response JSON,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES user_subscriptions(id) ON DELETE SET NULL,
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (payment_status),
    INDEX idx_transaction_id (transaction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. FEATURE ACCESS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS feature_access (
    id INT AUTO_INCREMENT PRIMARY KEY,
    feature_name VARCHAR(100) NOT NULL UNIQUE,
    requires_premium BOOLEAN DEFAULT TRUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_feature (feature_name, requires_premium)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default feature access rules
INSERT INTO feature_access (feature_name, requires_premium, description) VALUES
('food_analyzer', TRUE, 'AI-powered food image analysis'),
('diet_planner', TRUE, 'AI-generated personalized meal plans'),
('advanced_analytics', TRUE, 'Detailed nutritional analytics and insights'),
('water_tracker', FALSE, 'Basic water intake tracking'),
('calorie_tracking', FALSE, 'Manual calorie tracking'),
('dashboard', FALSE, 'Basic dashboard view')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- ============================================
-- 5. UPDATE USERS TABLE
-- ============================================
-- Add new columns to existing users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS profile_image VARCHAR(500),
ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email',
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS email_verified_at DATETIME NULL,
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS subscription_expires_at DATETIME NULL,
ADD COLUMN IF NOT EXISTS daily_water_goal INT DEFAULT 8;

-- Add index for Google ID
CREATE INDEX IF NOT EXISTS idx_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_subscription_status ON users(is_premium, subscription_expires_at);

CREATE TABLE IF NOT EXISTS email_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    used_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_email_verifications_user (user_id, created_at),
    INDEX idx_email_verifications_active (user_id, used_at, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. UPDATE WATER LOGS TABLE  
-- ============================================
-- Add daily goal tracking
ALTER TABLE water_logs
ADD COLUMN IF NOT EXISTS daily_goal INT DEFAULT 8;

-- ============================================
-- 7. USER SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    daily_water_goal INT DEFAULT 8,
    calorie_goal INT DEFAULT 2000,
    protein_goal FLOAT DEFAULT 50.0,
    carbs_goal FLOAT DEFAULT 250.0,
    fat_goal FLOAT DEFAULT 70.0,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    email_notifications BOOLEAN DEFAULT TRUE,
    theme VARCHAR(20) DEFAULT 'light',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 8. AUDIT LOG TABLE (for subscription changes)
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    subscription_id INT,
    action VARCHAR(50) NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    details JSON,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_action (user_id, action),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    sp.name as plan_name,
    us.start_date,
    us.end_date,
    DATEDIFF(us.end_date, NOW()) as days_remaining
FROM users u
INNER JOIN user_subscriptions us ON u.id = us.user_id
INNER JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE us.status = 'active' 
AND us.end_date > NOW();

-- View for subscription revenue
CREATE OR REPLACE VIEW subscription_revenue AS
SELECT 
    DATE_FORMAT(created_at, '%Y-%m') as month,
    COUNT(*) as total_transactions,
    SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END) as revenue,
    SUM(CASE WHEN payment_status = 'completed' THEN 1 ELSE 0 END) as successful_payments,
    SUM(CASE WHEN payment_status = 'failed' THEN 1 ELSE 0 END) as failed_payments
FROM payment_transactions
GROUP BY DATE_FORMAT(created_at, '%Y-%m')
ORDER BY month DESC;

-- ============================================
-- 10. STORED PROCEDURES
-- ============================================

-- Procedure to check and expire subscriptions
DELIMITER //
CREATE PROCEDURE expire_subscriptions()
BEGIN
    -- Update expired subscriptions
    UPDATE user_subscriptions 
    SET status = 'expired'
    WHERE status = 'active' 
    AND end_date <= NOW();
    
    -- Update user premium status
    UPDATE users u
    LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
    SET u.is_premium = CASE WHEN us.id IS NOT NULL THEN TRUE ELSE FALSE END,
        u.subscription_expires_at = us.end_date;
END //
DELIMITER ;

-- Procedure to activate subscription
DELIMITER //
CREATE PROCEDURE activate_subscription(
    IN p_user_id INT,
    IN p_plan_id INT,
    IN p_transaction_id VARCHAR(255)
)
BEGIN
    DECLARE v_duration INT;
    DECLARE v_start_date DATETIME;
    DECLARE v_end_date DATETIME;
    DECLARE v_subscription_id INT;
    
    -- Get plan duration
    SELECT duration_months INTO v_duration
    FROM subscription_plans
    WHERE id = p_plan_id;
    
    SET v_start_date = NOW();
    SET v_end_date = DATE_ADD(NOW(), INTERVAL v_duration MONTH);
    
    -- Create subscription
    INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date)
    VALUES (p_user_id, p_plan_id, 'active', v_start_date, v_end_date);
    
    SET v_subscription_id = LAST_INSERT_ID();
    
    -- Update user
    UPDATE users 
    SET is_premium = TRUE,
        subscription_expires_at = v_end_date
    WHERE id = p_user_id;
    
    -- Update payment transaction
    UPDATE payment_transactions
    SET subscription_id = v_subscription_id,
        payment_status = 'completed'
    WHERE transaction_id = p_transaction_id;
    
    -- Log audit
    INSERT INTO subscription_audit_log (user_id, subscription_id, action, new_status, details)
    VALUES (p_user_id, v_subscription_id, 'activated', 'active', 
            JSON_OBJECT('plan_id', p_plan_id, 'transaction_id', p_transaction_id));
    
    SELECT v_subscription_id as subscription_id, v_end_date as expires_at;
END //
DELIMITER ;

-- ============================================
-- 11. SCHEDULED EVENTS (MySQL Event Scheduler)
-- ============================================

-- Enable event scheduler
SET GLOBAL event_scheduler = ON;

-- Daily job to expire subscriptions
CREATE EVENT IF NOT EXISTS daily_subscription_check
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
CALL expire_subscriptions();

-- ============================================
-- 12. INDEXES FOR PERFORMANCE
-- ============================================

-- Additional indexes for better query performance
CREATE INDEX idx_user_premium ON users(is_premium);
CREATE INDEX idx_subscription_user_status ON user_subscriptions(user_id, status, end_date);
CREATE INDEX idx_payment_user_status ON payment_transactions(user_id, payment_status);

-- ============================================
-- SETUP COMPLETE
-- ============================================
-- After running this schema:
-- 1. Verify all tables exist: SHOW TABLES;
-- 2. Check indexes: SHOW INDEX FROM user_subscriptions;
-- 3. Test stored procedure: CALL expire_subscriptions();
-- ============================================

-- ============================================
-- 13. SUBSCRIPTION FIELDS ON USERS TABLE (NEW)
-- ============================================
-- Run this migration if upgrading from v1 schema.
-- Adds Razorpay-specific subscription tracking directly on users table.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS subscription_status ENUM('inactive','active','cancelled') DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS razorpay_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS payment_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS subscription_start_date DATETIME,
ADD COLUMN IF NOT EXISTS subscription_end_date DATETIME;

-- Index for fast subscription status queries
CREATE INDEX IF NOT EXISTS idx_razorpay_sub_id ON users(razorpay_subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_status ON users(subscription_status);

-- ============================================
-- 14. RAZORPAY WEBHOOK EVENTS LOG TABLE (NEW)
-- ============================================
CREATE TABLE IF NOT EXISTS razorpay_webhook_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSON NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_event_type (event_type),
    INDEX idx_processed (processed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
