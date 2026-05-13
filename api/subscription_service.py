"""
Subscription Management Service
================================
Business logic for subscription management, payments, and upgrades
"""

import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from decimal import Decimal
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import HTTPException


class SubscriptionService:
    """Service for managing subscriptions"""
    
    def __init__(self, get_db_func):
        """
        Initialize subscription service
        
        Args:
            get_db_func: Database connection function
        """
        self.get_db = get_db_func
    
    def get_all_plans(self) -> List[Dict[str, Any]]:
        """
        Get all active subscription plans with calculated fields
        
        Returns:
            List of subscription plans with pricing details
        """
        conn = self.get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cur.execute("""
                SELECT 
                    id,
                    name,
                    duration_months,
                    base_price,
                    final_price,
                    discount_amount,
                    badge,
                    features,
                    is_active
                FROM subscription_plans
                WHERE is_active = TRUE
                ORDER BY duration_months ASC
            """)
            
            plans = cur.fetchall()
            
            # Calculate additional fields
            for plan in plans:
                plan['savings_percentage'] = 0
                plan['monthly_equivalent'] = float(plan['final_price']) / plan['duration_months']
                
                if plan['discount_amount'] > 0:
                    plan['savings_percentage'] = round(
                        (float(plan['discount_amount']) / float(plan['base_price'])) * 100,
                        1
                    )
                
                # Convert Decimal to float for JSON serialization
                plan['base_price'] = float(plan['base_price'])
                plan['final_price'] = float(plan['final_price'])
                plan['discount_amount'] = float(plan['discount_amount'])
            
            return plans
            
        finally:
            cur.close()
            conn.close()
    
    def get_plan_by_id(self, plan_id: int) -> Optional[Dict[str, Any]]:
        """
        Get specific plan by ID
        
        Args:
            plan_id: Plan ID
            
        Returns:
            Plan dict or None
        """
        conn = self.get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cur.execute("""
                SELECT 
                    id, name, duration_months, base_price, final_price,
                    discount_amount, badge, features, is_active
                FROM subscription_plans
                WHERE id = %s AND is_active = TRUE
            """, (plan_id,))
            
            plan = cur.fetchone()
            
            if plan:
                plan['base_price'] = float(plan['base_price'])
                plan['final_price'] = float(plan['final_price'])
                plan['discount_amount'] = float(plan['discount_amount'])
                plan['monthly_equivalent'] = plan['final_price'] / plan['duration_months']
            
            return plan
            
        finally:
            cur.close()
            conn.close()
    
    def get_user_subscription(self, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Get user's current active subscription
        
        Args:
            user_id: User ID
            
        Returns:
            Subscription dict or None
        """
        conn = self.get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cur.execute("""
                SELECT 
                    us.id,
                    us.user_id,
                    us.plan_id,
                    sp.name as plan_name,
                    us.status,
                    us.start_date,
                    us.end_date,
                    us.auto_renew,
                    EXTRACT(DAY FROM us.end_date - NOW()) as days_remaining
                FROM user_subscriptions us
                INNER JOIN subscription_plans sp ON us.plan_id = sp.id
                WHERE us.user_id = %s
                AND us.status = 'active'
                AND us.end_date > NOW()
                ORDER BY us.end_date DESC
                LIMIT 1
            """, (user_id,))
            
            return cur.fetchone()
            
        finally:
            cur.close()
            conn.close()
    
    def create_payment_intent(self, user_id: int, plan_id: int, 
                              payment_method: str = "manual") -> Dict[str, Any]:
        """
        Create a payment transaction record
        
        Args:
            user_id: User ID
            plan_id: Selected plan ID
            payment_method: Payment method (manual, razorpay, stripe, etc.)
            
        Returns:
            Payment transaction details
        """
        plan = self.get_plan_by_id(plan_id)
        
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        
        # Generate unique transaction ID
        transaction_id = f"TXN_{secrets.token_urlsafe(16)}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        conn = self.get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cur.execute("""
                INSERT INTO payment_transactions
                (user_id, plan_id, amount, currency, payment_status, 
                 payment_method, transaction_id, created_at)
                VALUES (%s, %s, %s, 'INR', 'pending', %s, %s, NOW())
                RETURNING id
            """, (
                user_id,
                plan_id,
                plan['final_price'],
                payment_method,
                transaction_id
            ))
            
            conn.commit()
            payment_id = cur.fetchone()['id']
            
            return {
                "payment_id": payment_id,
                "transaction_id": transaction_id,
                "amount": plan['final_price'],
                "currency": "INR",
                "plan_name": plan['name'],
                "status": "pending",
                "created_at": datetime.now().isoformat()
            }
            
        finally:
            cur.close()
            conn.close()
    
    def activate_subscription(self, transaction_id: str, 
                             gateway_response: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Activate subscription after successful payment
        
        Args:
            transaction_id: Payment transaction ID
            gateway_response: Optional payment gateway response data
            
        Returns:
            Activated subscription details
        """
        conn = self.get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # Get transaction details
            cur.execute("""
                SELECT pt.id, pt.user_id, pt.plan_id, pt.payment_status,
                       sp.duration_months, sp.name as plan_name
                FROM payment_transactions pt
                INNER JOIN subscription_plans sp ON pt.plan_id = sp.id
                WHERE pt.transaction_id = %s
            """, (transaction_id,))
            
            transaction = cur.fetchone()
            
            if not transaction:
                raise HTTPException(status_code=404, detail="Transaction not found")
            
            if transaction['payment_status'] == 'completed':
                raise HTTPException(status_code=400, detail="Subscription already activated")
            
            # Calculate subscription dates
            start_date = datetime.now()
            end_date = start_date + timedelta(days=transaction['duration_months'] * 30)
            
            # Create subscription
            cur.execute("""
                INSERT INTO user_subscriptions
                (user_id, plan_id, status, start_date, end_date, created_at)
                VALUES (%s, %s, 'active', %s, %s, NOW())
                RETURNING id
            """, (
                transaction['user_id'],
                transaction['plan_id'],
                start_date,
                end_date
            ))
            
            subscription_id = cur.fetchone()['id']
            
            # Update transaction
            cur.execute("""
                UPDATE payment_transactions
                SET payment_status = 'completed',
                    subscription_id = %s,
                    gateway_response = %s,
                    updated_at = NOW()
                WHERE transaction_id = %s
            """, (subscription_id, str(gateway_response) if gateway_response else None, transaction_id))
            
            # Update user premium status
            cur.execute("""
                UPDATE users
                SET is_premium = TRUE,
                    subscription_expires_at = %s,
                    updated_at = NOW()
                WHERE id = %s
            """, (end_date, transaction['user_id']))
            
            # Log audit
            cur.execute("""
                INSERT INTO subscription_audit_log
                (user_id, subscription_id, action, new_status, details, created_at)
                VALUES (%s, %s, 'activated', 'active', %s, NOW())
            """, (
                transaction['user_id'],
                subscription_id,
                f'{{"plan": "{transaction["plan_name"]}", "transaction": "{transaction_id}"}}'
            ))
            
            conn.commit()
            
            return {
                "subscription_id": subscription_id,
                "plan_name": transaction['plan_name'],
                "status": "active",
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days_remaining": transaction['duration_months'] * 30
            }
            
        except psycopg2.Error as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        finally:
            cur.close()
            conn.close()
    
    def cancel_subscription(self, user_id: int, reason: Optional[str] = None,
                           immediate: bool = False) -> Dict[str, Any]:
        """
        Cancel user's subscription
        
        Args:
            user_id: User ID
            reason: Cancellation reason
            immediate: Cancel immediately or at period end
            
        Returns:
            Cancellation confirmation
        """
        subscription = self.get_user_subscription(user_id)
        
        if not subscription:
            raise HTTPException(status_code=404, detail="No active subscription found")
        
        conn = self.get_db()
        cur = conn.cursor()
        
        try:
            if immediate:
                # Cancel immediately
                cur.execute("""
                    UPDATE user_subscriptions
                    SET status = 'cancelled',
                        cancelled_at = NOW(),
                        end_date = NOW()
                    WHERE id = %s
                """, (subscription['id'],))
                
                # Update user premium status
                cur.execute("""
                    UPDATE users
                    SET is_premium = FALSE,
                        subscription_expires_at = NOW()
                    WHERE id = %s
                """, (user_id,))
                
                message = "Subscription cancelled immediately"
                
            else:
                # Cancel at period end
                cur.execute("""
                    UPDATE user_subscriptions
                    SET auto_renew = FALSE,
                        cancelled_at = NOW()
                    WHERE id = %s
                """, (subscription['id'],))
                
                message = f"Subscription will end on {subscription['end_date'].strftime('%Y-%m-%d')}"
            
            # Log audit
            cur.execute("""
                INSERT INTO subscription_audit_log
                (user_id, subscription_id, action, old_status, new_status, details, created_at)
                VALUES (%s, %s, 'cancelled', 'active', %s, %s, NOW())
            """, (
                user_id,
                subscription['id'],
                'cancelled' if immediate else 'ending',
                f'{{"reason": "{reason or "User requested"}", "immediate": {immediate}}}'
            ))
            
            conn.commit()
            
            return {
                "success": True,
                "message": message,
                "ends_at": subscription['end_date'].isoformat() if not immediate else datetime.now().isoformat()
            }
            
        finally:
            cur.close()
            conn.close()
    
    def get_subscription_stats(self) -> Dict[str, Any]:
        """
        Get subscription statistics (admin only)
        
        Returns:
            Subscription analytics
        """
        conn = self.get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # Total active subscriptions
            cur.execute("""
                SELECT COUNT(*) as count
                FROM user_subscriptions
                WHERE status = 'active' AND end_date > NOW()
            """)
            active_count = cur.fetchone()['count']
            
            # Total revenue
            cur.execute("""
                SELECT COALESCE(SUM(amount), 0) as total
                FROM payment_transactions
                WHERE payment_status = 'completed'
            """)
            total_revenue = float(cur.fetchone()['total'])
            
            # New subscriptions this month
            cur.execute("""
                SELECT COUNT(*) as count
                FROM user_subscriptions
                WHERE EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())
                AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
            """)
            new_this_month = cur.fetchone()['count']
            
            # Most popular plan
            cur.execute("""
                SELECT sp.name, COUNT(*) as count
                FROM user_subscriptions us
                INNER JOIN subscription_plans sp ON us.plan_id = sp.id
                WHERE us.status = 'active'
                GROUP BY sp.name
                ORDER BY count DESC
                LIMIT 1
            """)
            popular = cur.fetchone()
            
            return {
                "total_active_subscriptions": active_count,
                "total_revenue": total_revenue,
                "new_subscriptions_this_month": new_this_month,
                "popular_plan": popular['name'] if popular else "None",
                "churn_rate": 0.0  # Calculate based on cancellations
            }
            
        finally:
            cur.close()
            conn.close()
