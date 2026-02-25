# ============================================
# INTEGRATION GUIDE
# ============================================
# Step-by-step guide to integrate all features into your existing app

## TABLE OF CONTENTS
1. Database Setup
2. Backend Integration
3. Frontend Integration
4. Google OAuth Setup
5. Testing Guide
6. Deployment Checklist

## ============================================
## 1. DATABASE SETUP
## ============================================

### Step 1.1: Run Schema Updates
```bash
# Login to MySQL
mysql -u root -p

# Use your database
USE nutrilife_db;

# Run the schema file
source /path/to/database_schema.sql;

# Verify tables created
SHOW TABLES;

# Expected new tables:
# - subscription_plans
# - user_subscriptions
# - payment_transactions
# - feature_access
# - subscription_audit_log
# - user_settings

# Verify data inserted
SELECT * FROM subscription_plans;
SELECT * FROM feature_access;
```

### Step 1.2: Update Existing Users Table
The schema adds new columns to users table:
- google_id
- profile_image
- auth_provider
- is_premium
- subscription_expires_at
- daily_water_goal

These are added via ALTER TABLE statements in the schema.

### Step 1.3: Enable MySQL Event Scheduler
```sql
-- Enable event scheduler for auto-expiring subscriptions
SET GLOBAL event_scheduler = ON;

-- Verify
SHOW VARIABLES LIKE 'event_scheduler';
```

## ============================================
## 2. BACKEND INTEGRATION
## ============================================

### Step 2.1: Install New Dependencies
```bash
cd api
pip install google-auth google-auth-oauthlib google-auth-httplib2
pip install -r requirements.txt
```

### Step 2.2: Add New Files to Backend
Copy these files to your `api/` directory:
- models_subscription.py
- models_auth.py
- middleware_subscription.py
- google_auth_service.py
- subscription_service.py
- routes_subscription.py
- routes_google_auth.py
- routes_water.py

### Step 2.3: Update index.py
Add these imports to your existing `api/index.py`:

```python
# At the top of index.py, add:
from fastapi import APIRouter
import os

# Import new services
from google_auth_service import GoogleAuthService
from subscription_service import SubscriptionService
from middleware_subscription import create_subscription_middleware, FeatureGate

# Initialize services (after get_db is defined)
google_auth_service = GoogleAuthService(get_db, os.getenv("GOOGLE_CLIENT_ID"))
subscription_service = SubscriptionService(get_db)
subscription_middleware = create_subscription_middleware(get_db)
feature_gate = FeatureGate(subscription_middleware)

# Include routers (near the end of file, before if __name__ == "__main__")
from routes_subscription import subscription_router
from routes_google_auth import google_auth_router
from routes_water import water_router

app.include_router(subscription_router)
app.include_router(google_auth_router)
app.include_router(water_router)
```

### Step 2.4: Protect Premium Routes
Update your existing premium feature routes:

**BEFORE:**
```python
@app.post("/api/analyze-food")
async def analyze_food(user: dict = Depends(require_auth)):
    # Your existing code
    pass
```

**AFTER:**
```python
@app.post("/api/analyze-food")
async def analyze_food(user: dict = Depends(require_auth)):
    # Check premium access
    access = subscription_middleware.check_feature_access(user['id'], 'food_analyzer')
    if not access['has_access']:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "Premium subscription required",
                "message": access['message'],
                "upgrade_required": True
            }
        )
    
    # Your existing code
    pass
```

Do this for:
- `/api/analyze-food` → feature: `food_analyzer`
- `/api/diet-plan/*` → feature: `diet_planner`
- `/api/analytics/*` → feature: `advanced_analytics`

### Step 2.5: Update Environment Variables
Create `.env` file in `api/` directory:
```bash
cp .env.example api/.env
```

Edit and add:
```
GOOGLE_CLIENT_ID=your_google_client_id_here
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=nutrilife_db
OPENROUTER_API_KEY=your_key_here
```

## ============================================
## 3. FRONTEND INTEGRATION
## ============================================

### Step 3.1: Install Dependencies
```bash
cd your-frontend-directory
npm install @react-oauth/google
# or
yarn add @react-oauth/google
```

### Step 3.2: Add New Components
Copy these files to your `components/` directory:
- premium-gate.tsx
- enhanced-water-intake.tsx
- google-sign-in-button.tsx

Create new page:
- app/subscription/page.tsx (copy from subscription-page.tsx)

### Step 3.3: Update Layout.tsx
Wrap your app with GoogleOAuthProvider:

```tsx
// app/layout.tsx
import { GoogleOAuthProvider } from '@react-oauth/google'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
          <AuthProvider>
            <ThemeProvider>
              {children}
            </ThemeProvider>
          </AuthProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  )
}
```

### Step 3.4: Update Auth Context
Add Google login method to your auth-context.tsx:

```tsx
// lib/auth-context.tsx

// Add to AuthContextType interface:
interface AuthContextType {
  // ... existing
  loginWithGoogle: (credential: string) => Promise<{ success: boolean; error?: string }>
}

// Add to AuthProvider:
const loginWithGoogle = async (credential: string) => {
  try {
    const response = await fetch(`${API_URL}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.detail }
    }

    localStorage.setItem("nutrilife_token", data.token)
    setToken(data.token)
    setUser(data.user)

    return { success: true }
  } catch (error) {
    return { success: false, error: "Google login failed" }
  }
}

// Add to value:
const value = {
  // ... existing
  loginWithGoogle,
}
```

### Step 3.5: Protect Premium Pages
Wrap premium features with PremiumGate:

**food-analysis/page.tsx:**
```tsx
import { PremiumGate } from '@/components/premium-gate'

export default function FoodAnalysisPage() {
  return (
    <PremiumGate feature="food_analyzer">
      {/* Your existing food analysis component */}
    </PremiumGate>
  )
}
```

**diet-planner/page.tsx:**
```tsx
import { PremiumGate } from '@/components/premium-gate'

export default function DietPlannerPage() {
  return (
    <PremiumGate feature="diet_planner">
      {/* Your existing diet planner component */}
    </PremiumGate>
  )
}
```

### Step 3.6: Add Subscription Link to Navigation
Update sidebar-nav.tsx:

```tsx
const navItems = [
  // ... existing items
  {
    title: "Subscription",
    href: "/subscription",
    icon: Crown, // import from lucide-react
  },
]
```

### Step 3.7: Replace Water Widget
In your dashboard (page.tsx), replace the old water widget:

**BEFORE:**
```tsx
<WaterIntakeWidget currentGlasses={...} targetGlasses={...} />
```

**AFTER:**
```tsx
import { EnhancedWaterIntake } from '@/components/enhanced-water-intake'

<EnhancedWaterIntake onUpdate={refreshDashboard} />
```

### Step 3.8: Update Environment Variables
Create `.env.local` in root:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id_here
```

## ============================================
## 4. GOOGLE OAUTH SETUP
## ============================================

### Step 4.1: Create Google Cloud Project
1. Go to: https://console.cloud.google.com
2. Create new project or select existing
3. Project name: "NutriLife" (or your app name)

### Step 4.2: Enable Google+ API
1. Navigate to "APIs & Services" > "Library"
2. Search for "Google+ API"
3. Click "Enable"

### Step 4.3: Create OAuth Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Application type: "Web application"
4. Name: "NutriLife Web Client"
5. Authorized JavaScript origins:
   - http://localhost:3000
   - https://your-domain.com (for production)
6. Authorized redirect URIs:
   - http://localhost:3000
   - https://your-domain.com (for production)
7. Click "Create"
8. Copy Client ID

### Step 4.4: Add to Environment
- Backend `.env`: `GOOGLE_CLIENT_ID=...`
- Frontend `.env.local`: `NEXT_PUBLIC_GOOGLE_CLIENT_ID=...`

### Step 4.5: Test Google Login
1. Start backend: `uvicorn index:app --reload`
2. Start frontend: `npm run dev`
3. Go to login page
4. Click "Sign in with Google"
5. Verify authentication works

## ============================================
## 5. TESTING GUIDE
## ============================================

### Test 1: Database Schema
```bash
mysql -u root -p nutrilife_db

# Check tables exist
SHOW TABLES;

# Check subscription plans
SELECT * FROM subscription_plans;

# Expected: 3 plans (3-month, 6-month, 1-year)

# Check feature access
SELECT * FROM feature_access;

# Expected: food_analyzer, diet_planner, advanced_analytics, etc.
```

### Test 2: Backend API Endpoints
```bash
# Get subscription plans
curl http://localhost:8000/api/subscription/plans

# Should return 3 plans with pricing

# Health check
curl http://localhost:8000/health

# Should show database connected
```

### Test 3: Google OAuth
1. Open http://localhost:3000/login
2. Click "Sign in with Google"
3. Select Google account
4. Verify redirect to dashboard
5. Check user created in database:
```sql
SELECT * FROM users WHERE auth_provider = 'google';
```

### Test 4: Subscription Flow
1. Login to app
2. Go to /subscription
3. Select a plan
4. Click "Get Started"
5. Verify subscription created:
```sql
SELECT * FROM user_subscriptions ORDER BY created_at DESC LIMIT 1;
```
6. Check user is premium:
```sql
SELECT is_premium, subscription_expires_at FROM users WHERE id = <user_id>;
```

### Test 5: Feature Access
1. Without subscription:
   - Try to access /food-analysis
   - Should see "Premium Required" modal

2. With subscription:
   - Access /food-analysis
   - Should work normally

### Test 6: Water Intake
1. Go to dashboard
2. Click + button on water widget
3. Verify count increases without page reload
4. Check database:
```sql
SELECT * FROM water_logs WHERE user_id = <user_id> AND log_date = CURDATE();
```

## ============================================
## 6. DEPLOYMENT CHECKLIST
## ============================================

### Pre-Deployment
- [ ] Run all tests
- [ ] Set DEBUG=False
- [ ] Use production database
- [ ] Set strong JWT_SECRET_KEY
- [ ] Configure HTTPS
- [ ] Update CORS origins
- [ ] Set up SSL certificates
- [ ] Configure firewall

### Database
- [ ] Backup current database
- [ ] Run schema on production DB
- [ ] Verify all tables created
- [ ] Enable event scheduler
- [ ] Set up automated backups

### Backend
- [ ] Update requirements.txt
- [ ] Set production environment variables
- [ ] Configure gunicorn
- [ ] Set up process manager (systemd, supervisor)
- [ ] Configure reverse proxy (nginx)
- [ ] Enable rate limiting

### Frontend
- [ ] Update API_URL to production
- [ ] Set production Google Client ID
- [ ] Build: `npm run build`
- [ ] Configure deployment (Vercel, Netlify, etc.)

### Payment Gateway
- [ ] Switch to live Razorpay/Stripe keys
- [ ] Test payment flow end-to-end
- [ ] Set up webhook endpoints
- [ ] Verify webhook signatures

### Monitoring
- [ ] Set up error logging (Sentry)
- [ ] Configure analytics
- [ ] Set up uptime monitoring
- [ ] Enable performance monitoring

### Security
- [ ] Run security audit
- [ ] Enable CSRF protection
- [ ] Validate all inputs
- [ ] Use prepared statements
- [ ] Rate limit API endpoints
- [ ] Set up WAF if needed

## ============================================
## TROUBLESHOOTING
## ============================================

### Issue: Google login fails
- Check Client ID matches in .env
- Verify authorized origins configured
- Check browser console for errors
- Verify Google+ API enabled

### Issue: Subscription not activating
- Check transaction in payment_transactions table
- Verify stored procedure exists: `SHOW PROCEDURE STATUS LIKE 'activate_subscription'`
- Check user_subscriptions table
- Look at subscription_audit_log for errors

### Issue: Feature access not working
- Verify feature_access table has data
- Check user is_premium status
- Test middleware with direct API call
- Check subscription expiry date

### Issue: Water intake not updating
- Check network tab for API errors
- Verify water_logs table exists
- Check user authentication
- Verify daily_stats table updates

## ============================================
## SUPPORT
## ============================================

For issues or questions:
1. Check logs: backend terminal and browser console
2. Verify database tables and data
3. Test API endpoints with curl/Postman
4. Check environment variables
5. Review error messages carefully

Good luck with your integration! 🚀
