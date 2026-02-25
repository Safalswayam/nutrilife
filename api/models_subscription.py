"""
Subscription System Models
============================
Pydantic models for subscription and payment management
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class SubscriptionStatus(str, Enum):
    """Subscription status enum"""
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    PENDING = "pending"


class PaymentStatus(str, Enum):
    """Payment status enum"""
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class SubscriptionPlanResponse(BaseModel):
    """Response model for subscription plan"""
    id: int
    name: str
    duration_months: int
    base_price: float
    final_price: float
    discount_amount: float
    badge: Optional[str] = None
    features: List[str]
    is_active: bool
    
    # Calculated fields
    savings_percentage: Optional[float] = None
    monthly_equivalent: Optional[float] = None
    
    class Config:
        from_attributes = True


class UserSubscriptionResponse(BaseModel):
    """Response model for user subscription"""
    id: int
    user_id: int
    plan_id: int
    plan_name: str
    status: SubscriptionStatus
    start_date: datetime
    end_date: datetime
    days_remaining: int
    auto_renew: bool
    
    class Config:
        from_attributes = True


class CreatePaymentRequest(BaseModel):
    """Request to create a payment intent"""
    plan_id: int
    payment_method: Optional[str] = "manual"  # Will be 'razorpay', 'stripe' etc in production
    
    @field_validator("plan_id")
    @classmethod
    def validate_plan_id(cls, v):
        if v <= 0:
            raise ValueError("Invalid plan ID")
        return v


class PaymentCallbackRequest(BaseModel):
    """Payment gateway callback request"""
    transaction_id: str
    payment_status: PaymentStatus
    gateway_response: Optional[Dict[str, Any]] = None
    
    @field_validator("transaction_id")
    @classmethod
    def validate_transaction_id(cls, v):
        if not v or len(v) < 10:
            raise ValueError("Invalid transaction ID")
        return v


class PaymentTransactionResponse(BaseModel):
    """Payment transaction response"""
    id: int
    transaction_id: str
    amount: float
    currency: str
    payment_status: PaymentStatus
    payment_method: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class SubscriptionUpgradeRequest(BaseModel):
    """Request to upgrade subscription"""
    new_plan_id: int
    
    @field_validator("new_plan_id")
    @classmethod
    def validate_plan_id(cls, v):
        if v <= 0:
            raise ValueError("Invalid plan ID")
        return v


class CancelSubscriptionRequest(BaseModel):
    """Request to cancel subscription"""
    reason: Optional[str] = None
    immediate: bool = False  # Cancel immediately or at end of period


class FeatureAccessResponse(BaseModel):
    """Feature access information"""
    feature_name: str
    has_access: bool
    requires_premium: bool
    subscription_required: bool
    message: Optional[str] = None


class SubscriptionStatsResponse(BaseModel):
    """Subscription statistics for admin"""
    total_active_subscriptions: int
    total_revenue: float
    new_subscriptions_this_month: int
    churn_rate: float
    popular_plan: str
    
    class Config:
        from_attributes = True
