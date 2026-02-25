"""
Razorpay Webhook Handler
========================
This module is imported by index.py.
The webhook endpoint is registered directly in index.py as /api/webhook/razorpay.

Standalone reference for the webhook logic is documented here.

Events handled
--------------
| Event                    | Action                                      |
|--------------------------|---------------------------------------------|
| subscription.activated   | Set user subscription_status = 'active'     |
| subscription.charged     | Same as activated (renewal payment)         |
| subscription.cancelled   | Set user subscription_status = 'cancelled'  |
| payment.failed           | Set user subscription_status = 'inactive'   |

Security
--------
- X-Razorpay-Signature header verified via HMAC-SHA256
- Event IDs are stored in razorpay_webhook_events table to prevent replay
- All DB writes use parameterised queries

Configuration
-------------
Set the following in api/.env:
  RAZORPAY_WEBHOOK_SECRET=<secret from Razorpay dashboard>

Register webhook in Razorpay Dashboard
--------------------------------------
  Dashboard → Settings → Webhooks → Add New Webhook
  URL: https://<your-api-domain>/api/webhook/razorpay
  Secret: <same as RAZORPAY_WEBHOOK_SECRET>
  Active Events:
    ✅ subscription.activated
    ✅ subscription.charged
    ✅ subscription.cancelled
    ✅ payment.failed
"""
# The actual implementation lives in index.py to avoid circular imports.
# See the _webhook_* helper functions and the /api/webhook/razorpay route.
