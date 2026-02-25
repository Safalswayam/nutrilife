"""
Subscription API Routes
=======================
FastAPI routes for subscription management

Add these routes to your main index.py file
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from typing import List
import os

# Import your existing dependencies
# from your_existing_file import get_db, require_auth, get_current_user

# Import new services and models
from index import require_auth,get_db
from subscription_service import SubscriptionService
from middleware_subscription import create_subscription_middleware, FeatureGate
from models_subscription import (
    SubscriptionPlanResponse,
    UserSubscriptionResponse,
    CreatePaymentRequest,
    PaymentCallbackRequest,
    PaymentTransactionResponse,
    CancelSubscriptionRequest,
    FeatureAccessResponse
)

# Initialize router
subscription_router = APIRouter(prefix="/api/subscription", tags=["Subscription"])

# Initialize services (you need to pass your get_db function)
# subscription_service = SubscriptionService(get_db)
subscription_middleware = create_subscription_middleware(get_db)
feature_gate = FeatureGate(subscription_middleware)


# =========================
# SUBSCRIPTION PLANS ROUTES
# =========================

@subscription_router.get("/plans", response_model=List[SubscriptionPlanResponse])
async def get_subscription_plans():
    """
    Get all available subscription plans
    
    Returns pricing tiers with calculations for:
    - Base price vs discounted price
    - Monthly equivalent cost
    - Savings percentage
    - Feature list per plan
    """
    try:
        plans = SubscriptionService.get_all_plans()
        return plans
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@subscription_router.get("/my-subscription", response_model=UserSubscriptionResponse)
async def get_my_subscription(user: dict = Depends(require_auth)):
    """
    Get current user's active subscription
    
    Returns:
    - Subscription status
    - Plan details
    - Expiry date
    - Days remaining
    """
    try:
        subscription = SubscriptionService.get_user_subscription(user['id'])
        
        if not subscription:
            raise HTTPException(
                status_code=404,
                detail="No active subscription found"
            )
        
        return subscription
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# PAYMENT ROUTES
# =========================

@subscription_router.post("/create-payment")
async def create_payment(
    request: CreatePaymentRequest,
    user: dict = Depends(require_auth)
):
    """
    Create a payment intent for subscription
    
    In production, this would integrate with:
    - Razorpay
    - Stripe
    - PayPal
    
    For now, returns a mock payment transaction
    """
    try:
        payment = SubscriptionService.create_payment_intent(
            user['id'],
            request.plan_id,
            request.payment_method
        )
        
        # In production, you would:
        # 1. Create Razorpay/Stripe order
        # 2. Return order ID and payment details
        # 3. Frontend handles payment gateway
        
        return {
            "success": True,
            "payment": payment,
            "message": "Payment created. Proceed with payment gateway.",
            # Mock: For demo purposes, auto-activate
            "mock_mode": True,
            "instructions": "In production, integrate with payment gateway"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@subscription_router.post("/activate-subscription")
async def activate_subscription_manual(
    transaction_id: str,
    user: dict = Depends(require_auth)
):
    """
    Activate subscription after payment
    
    In production, this would be called by payment gateway webhook
    For demo, allows manual activation
    """
    try:
        subscription = SubscriptionService.activate_subscription(
            transaction_id=transaction_id,
            gateway_response={"status": "success", "mode": "manual"}
        )
        
        return {
            "success": True,
            "subscription": subscription,
            "message": "Subscription activated successfully!"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@subscription_router.post("/payment/webhook")
async def payment_webhook(
    request: PaymentCallbackRequest,
    req: Request
):
    """
    Payment gateway webhook handler
    
    Called by Razorpay/Stripe after payment completion
    
    Security:
    - Verify webhook signature
    - Validate payment status
    - Prevent replay attacks
    """
    try:
        # TODO: Verify webhook signature
        # razorpay_signature = req.headers.get("X-Razorpay-Signature")
        # verify_signature(razorpay_signature, request.dict())
        
        if request.payment_status == "completed":
            subscription = SubscriptionService.activate_subscription(
                transaction_id=request.transaction_id,
                gateway_response=request.gateway_response
            )
            
            return {
                "success": True,
                "subscription_id": subscription['subscription_id']
            }
        else:
            # Mark payment as failed
            # Update transaction status
            return {
                "success": False,
                "message": "Payment failed"
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# SUBSCRIPTION MANAGEMENT
# =========================

@subscription_router.post("/cancel")
async def cancel_subscription(
    request: CancelSubscriptionRequest,
    user: dict = Depends(require_auth)
):
    """
    Cancel current subscription
    
    Options:
    - immediate: Cancel right now
    - at_period_end: Cancel when current period expires
    """
    try:
        result = SubscriptionService.cancel_subscription(
            user['id'],
            reason=request.reason,
            immediate=request.immediate
        )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@subscription_router.get("/status")
async def get_subscription_status(user: dict = Depends(require_auth)):
    """
    Get user's subscription status including:
    - Is premium
    - Plan details
    - Days remaining
    - Features available
    """
    try:
        status = subscription_middleware.check_subscription_status(user['id'])
        
        # Get blocked features 
        blocked = FeatureGate.get_blocked_features(user['id'])
        
        return {
            **status,
            "blocked_features": blocked
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# FEATURE ACCESS ROUTES
# =========================

@subscription_router.get("/feature-access/{feature_name}", response_model=FeatureAccessResponse)
async def check_feature_access(
    feature_name: str,
    user: dict = Depends(require_auth)
):
    """
    Check if user has access to a specific feature
    
    Features:
    - food_analyzer
    - diet_planner
    - advanced_analytics
    """
    try:
        access = subscription_middleware.check_feature_access(
            user['id'],
            feature_name
        )
        
        return {
            "feature_name": feature_name,
            "has_access": access['has_access'],
            "requires_premium": access['requires_premium'],
            "subscription_required": access['requires_premium'],
            "message": access['message']
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# ADMIN ROUTES (Optional)
# =========================

@subscription_router.get("/admin/stats")
async def get_subscription_stats(user: dict = Depends(require_auth)):
    """
    Get subscription analytics
    
    TODO: Add admin role check
    """
    try:
        # TODO: Verify user is admin
        # if user.get('role') != 'admin':
        #     raise HTTPException(status_code=403, detail="Admin access required")
        
        stats = SubscriptionService.get_subscription_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# USAGE EXAMPLE IN MAIN APP
# =========================
"""
# In your main index.py:

from fastapi import FastAPI
from subscription_routes import subscription_router

app = FastAPI()

# Include subscription routes
app.include_router(subscription_router)

# Now your API has:
# - GET  /api/subscription/plans
# - GET  /api/subscription/my-subscription  
# - POST /api/subscription/create-payment
# - POST /api/subscription/activate-subscription
# - POST /api/subscription/cancel
# - GET  /api/subscription/status
# - GET  /api/subscription/feature-access/{feature}
"""
