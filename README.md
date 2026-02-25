# 🥗 Enhanced NutriLife - Health & Diet Planner

## Production-Ready Subscription System with Premium Features

A comprehensive health and diet planning application with AI-powered features, subscription management, Google OAuth authentication, and enhanced user experience.

---

## ✨ New Features Implemented

### 1. 💳 **Subscription System**
- **3 Pricing Tiers:**
  - 3-Month Plan: ₹299 (Base)
  - 6-Month Plan: ₹549 (Save ₹49) - ⭐ Popular
  - 1-Year Plan: ₹849 (Save ₹347) - 🔥 Best Value

- **Features:**
  - Dynamic pricing calculations
  - Monthly equivalent view toggle
  - Savings percentage display
  - Professional pricing cards UI
  - Animated transitions
  - Mock payment integration (production-ready for Razorpay/Stripe)

### 2. 🔐 **Free vs Premium Access Control**
- **Free Features:**
  - ✅ Water intake tracking
  - ✅ Basic dashboard view
  - ✅ Manual calorie tracking
  - ✅ Profile management

- **Premium Features (Locked):**
  - 🔒 AI Food Analyzer (image recognition)
  - 🔒 Diet Planner (AI-generated meal plans)
  - 🔒 Advanced Analytics & Insights

- **Smart Feature Gate:**
  - Blurred UI overlay for locked features
  - Beautiful upgrade modal with feature benefits
  - Backend validation (not just frontend checks)
  - Contextual upgrade prompts

### 3. 💧 **Enhanced Water Intake Tracker**
- **Visual Improvements:**
  - Animated glass filling effect
  - Real-time progress circle
  - Beautiful color transitions
  - Wave animation in water glass
  - Goal reached celebration 🎉

- **Functionality:**
  - No page reload on updates
  - Optimistic UI updates
  - Editable daily goal (1-20 glasses)
  - Goal settings modal
  - Encouragement messages
  - 7-day history view
  - Auto-reset at midnight

- **Database Integration:**
  - Real-time sync with backend
  - Daily stats tracking
  - Historical data storage

### 4. 🔑 **Google OAuth Authentication**
- **Seamless Login:**
  - One-tap Google Sign-In
  - Auto-registration for new users
  - Account linking for existing users
  - Profile picture sync

- **Security:**
  - Token verification with Google
  - Secure session management
  - JWT token generation
  - HTTPOnly cookies support
  - Duplicate account prevention

- **User Experience:**
  - "Welcome back" vs "Welcome" messages
  - Smooth authentication flow
  - Auto-redirect after login
  - Profile data sync

### 5. 🏗️ **Clean Architecture**
- **Backend Structure:**
  ```
  api/
  ├── models_subscription.py    # Pydantic models
  ├── models_auth.py            # Auth models
  ├── middleware_subscription.py # Feature access control
  ├── google_auth_service.py    # OAuth service
  ├── subscription_service.py   # Business logic
  ├── routes_subscription.py    # API routes
  ├── routes_google_auth.py     # Auth routes
  └── routes_water.py           # Water tracking routes
  ```

- **Frontend Structure:**
  ```
  components/
  ├── premium-gate.tsx           # Feature restriction
  ├── enhanced-water-intake.tsx  # Water widget
  ├── google-sign-in-button.tsx # OAuth button
  app/
  └── subscription/
      └── page.tsx               # Pricing page
  ```

### 6. 🗄️ **Database Enhancements**
- **New Tables:**
  - `subscription_plans` - Pricing tiers
  - `user_subscriptions` - Active subscriptions
  - `payment_transactions` - Payment records
  - `feature_access` - Permission rules
  - `subscription_audit_log` - Activity tracking
  - `user_settings` - User preferences

- **Enhanced Tables:**
  - `users` - Added google_id, profile_image, is_premium, subscription_expires_at
  - `water_logs` - Improved tracking

- **Stored Procedures:**
  - `expire_subscriptions()` - Auto-expire old subscriptions
  - `activate_subscription()` - Atomic activation

- **Automated Jobs:**
  - Daily subscription expiry check
  - MySQL Event Scheduler

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- MySQL 8.0+
- Google Cloud Project (for OAuth)

### 1. Database Setup
```bash
# Create database
mysql -u root -p
CREATE DATABASE nutrilife_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Run schema
mysql -u root -p nutrilife_db < backend/database_schema.sql

# Verify
SHOW TABLES;
```

### 2. Backend Setup
```bash
cd api

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Install Google Auth
pip install google-auth google-auth-oauthlib

# Configure environment
cp ../.env.example .env
# Edit .env with your credentials

# Start server
uvicorn index:app --reload --port 8000
```

### 3. Frontend Setup
```bash
# Install dependencies
npm install
# or
yarn install

# Install Google OAuth
npm install @react-oauth/google

# Configure environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Start development server
npm run dev
# or
yarn dev
```

### 4. Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized origins:
   - `http://localhost:3000`
   - Your production domain
6. Copy Client ID
7. Add to `.env` and `.env.local`

---

## 📁 Project Structure

```
enhanced-nutrition-app/
├── backend/
│   ├── database_schema.sql          # Complete database schema
│   ├── models_subscription.py       # Subscription models
│   ├── models_auth.py              # Authentication models
│   ├── middleware_subscription.py   # Access control middleware
│   ├── google_auth_service.py      # OAuth service
│   ├── subscription_service.py     # Business logic
│   ├── routes_subscription.py      # Subscription API
│   ├── routes_google_auth.py       # OAuth API
│   ├── routes_water.py             # Water tracking API
│   └── requirements.txt            # Python dependencies
│
├── frontend/
│   ├── subscription-page.tsx       # Pricing page
│   ├── premium-gate.tsx            # Feature gate component
│   ├── enhanced-water-intake.tsx   # Water tracker
│   └── google-sign-in-button.tsx   # OAuth button
│
├── .env.example                     # Environment template
├── INTEGRATION_GUIDE.md            # Step-by-step integration
└── README.md                       # This file
```

---

## 🔧 Configuration

### Environment Variables

**Backend (.env):**
```env
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=nutrilife_db
GOOGLE_CLIENT_ID=your_client_id
OPENROUTER_API_KEY=your_api_key
```

**Frontend (.env.local):**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id
```

---

## 📊 API Endpoints

### Subscription
- `GET /api/subscription/plans` - Get all plans
- `GET /api/subscription/my-subscription` - Current subscription
- `POST /api/subscription/create-payment` - Create payment
- `POST /api/subscription/activate-subscription` - Activate subscription
- `POST /api/subscription/cancel` - Cancel subscription
- `GET /api/subscription/status` - Subscription status
- `GET /api/subscription/feature-access/{feature}` - Check feature access

### Authentication
- `POST /api/auth/google` - Google OAuth login
- `GET /api/auth/me` - Current user info
- `PUT /api/auth/profile` - Update profile

### Water Tracking
- `POST /api/water/adjust` - Add/remove glass
- `GET /api/water/today` - Today's intake
- `POST /api/water/set-goal` - Set daily goal
- `GET /api/water/history` - Historical data

---

## 🎨 UI/UX Enhancements

### Design Principles
- ✅ Mobile-first responsive design
- ✅ Smooth animations and transitions
- ✅ Professional color scheme
- ✅ Accessible components (ARIA labels)
- ✅ Loading states and error handling
- ✅ Toast notifications for feedback
- ✅ Optimistic UI updates

### Key Components
1. **Pricing Cards**
   - Gradient backgrounds
   - Badge indicators (Popular, Best Value)
   - Hover effects
   - Responsive grid layout

2. **Premium Gate**
   - Backdrop blur effect
   - Modal with benefits list
   - Contextual messaging
   - Clear call-to-action

3. **Water Tracker**
   - Animated glass visualization
   - Circular progress indicator
   - Real-time updates
   - Goal celebration animation

---

## 🔒 Security Features

### Authentication
- ✅ Google OAuth 2.0 verification
- ✅ JWT token-based sessions
- ✅ Secure password hashing (bcrypt)
- ✅ Token expiration (30 days)
- ✅ IP address logging

### Authorization
- ✅ Backend feature access validation
- ✅ Middleware protection
- ✅ Role-based access control
- ✅ Subscription expiry checks

### Database
- ✅ Prepared statements (SQL injection prevention)
- ✅ Input validation (Pydantic)
- ✅ Foreign key constraints
- ✅ Audit logging

### API
- ✅ CORS configuration
- ✅ Rate limiting ready
- ✅ Error handling
- ✅ Request validation

---

## 💳 Payment Integration

### Current: Mock/Demo Mode
For testing, subscriptions can be activated manually without actual payment.

### Production Setup (Razorpay)
1. Sign up at [razorpay.com](https://razorpay.com)
2. Get API keys
3. Add to `.env`:
   ```
   RAZORPAY_KEY_ID=rzp_live_...
   RAZORPAY_KEY_SECRET=...
   ```
4. Implement webhook handler:
   ```python
   @app.post("/api/subscription/payment/webhook")
   async def razorpay_webhook(request: Request):
       # Verify signature
       # Activate subscription
       pass
   ```

### Alternative: Stripe
Similar setup for Stripe integration.

---

## 📈 Database Schema Highlights

### Subscription Plans
```sql
CREATE TABLE subscription_plans (
    id INT PRIMARY KEY,
    name VARCHAR(50),
    duration_months INT,
    base_price DECIMAL(10,2),
    final_price DECIMAL(10,2),
    discount_amount DECIMAL(10,2),
    badge VARCHAR(50),
    features JSON
);
```

### User Subscriptions
```sql
CREATE TABLE user_subscriptions (
    id INT PRIMARY KEY,
    user_id INT,
    plan_id INT,
    status ENUM('active', 'expired', 'cancelled'),
    start_date DATETIME,
    end_date DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Payment Transactions
```sql
CREATE TABLE payment_transactions (
    id INT PRIMARY KEY,
    user_id INT,
    subscription_id INT,
    amount DECIMAL(10,2),
    payment_status ENUM('pending', 'completed', 'failed'),
    transaction_id VARCHAR(255) UNIQUE,
    gateway_response JSON
);
```

---

## 🧪 Testing

### Manual Testing
1. **Subscription Flow:**
   - Visit `/subscription`
   - Select a plan
   - Verify modal appears
   - Complete mock payment
   - Check database for record

2. **Feature Access:**
   - Login without subscription
   - Try to access `/food-analysis`
   - Verify upgrade modal
   - Subscribe
   - Verify access granted

3. **Water Tracking:**
   - Click + button
   - Verify count updates without reload
   - Set custom goal
   - Check persistence

4. **Google OAuth:**
   - Click "Sign in with Google"
   - Complete OAuth flow
   - Verify account created
   - Test subsequent login

### Database Verification
```sql
-- Check subscriptions
SELECT u.email, us.status, sp.name, us.end_date
FROM users u
JOIN user_subscriptions us ON u.id = us.user_id
JOIN subscription_plans sp ON us.plan_id = sp.id;

-- Check payments
SELECT * FROM payment_transactions ORDER BY created_at DESC;

-- Check water logs
SELECT user_id, log_date, SUM(glasses) as total
FROM water_logs
GROUP BY user_id, log_date;
```

---

## 🐛 Troubleshooting

### Common Issues

**Issue: Google login fails**
```
Solution:
1. Verify Client ID matches
2. Check authorized origins in Google Console
3. Enable Google+ API
4. Clear browser cache
```

**Issue: Subscription not activating**
```
Solution:
1. Check payment_transactions table
2. Verify stored procedures exist
3. Check user_subscriptions table
4. Review subscription_audit_log
```

**Issue: Premium features still locked**
```
Solution:
1. Verify user.is_premium = TRUE
2. Check subscription end_date > NOW()
3. Test API endpoint directly
4. Clear localStorage and re-login
```

**Issue: Water intake not updating**
```
Solution:
1. Check browser console for errors
2. Verify API endpoint responding
3. Check authentication token
4. Verify database connection
```

---

## 📝 Code Quality

### Best Practices Implemented
- ✅ Type hints (Python)
- ✅ TypeScript (Frontend)
- ✅ Pydantic validation
- ✅ Error handling
- ✅ Logging
- ✅ Comments for complex logic
- ✅ Modular architecture
- ✅ Separation of concerns
- ✅ DRY principle
- ✅ SOLID principles

### Code Organization
- Models in separate files
- Business logic in services
- Routes in route files
- Middleware for cross-cutting concerns
- Reusable components
- Consistent naming conventions

---

## 🚀 Deployment

### Production Checklist
- [ ] Set `DEBUG=False`
- [ ] Use production database
- [ ] Strong `JWT_SECRET_KEY`
- [ ] Configure HTTPS
- [ ] Set up SSL certificates
- [ ] Update CORS origins
- [ ] Enable rate limiting
- [ ] Set up monitoring (Sentry)
- [ ] Configure CDN
- [ ] Set up backups
- [ ] Switch to live payment keys
- [ ] Test payment webhooks
- [ ] Performance testing
- [ ] Security audit

### Deployment Options

**Backend:**
- Heroku
- DigitalOcean
- AWS EC2
- Google Cloud Run
- Railway

**Frontend:**
- Vercel (recommended for Next.js)
- Netlify
- AWS Amplify
- Cloudflare Pages

**Database:**
- AWS RDS
- Google Cloud SQL
- DigitalOcean Managed Database
- PlanetScale

---

## 📄 License

This project is provided as-is for educational and commercial use.

---

## 🤝 Support

For questions or issues:
1. Check INTEGRATION_GUIDE.md
2. Review code comments
3. Test with provided examples
4. Check database logs
5. Verify environment variables

---

## 🎯 Future Enhancements

Potential additions:
- [ ] Email notifications
- [ ] PDF receipt generation
- [ ] Subscription auto-renewal
- [ ] Referral program
- [ ] Family plans
- [ ] Mobile apps (React Native)
- [ ] Admin dashboard
- [ ] Analytics dashboard
- [ ] Export data feature
- [ ] Social media integration

---

## 📊 Feature Comparison

| Feature | Free | Premium |
|---------|------|---------|
| Water Tracking | ✅ | ✅ |
| Basic Dashboard | ✅ | ✅ |
| Manual Calorie Log | ✅ | ✅ |
| AI Food Analyzer | ❌ | ✅ |
| Diet Planner | ❌ | ✅ |
| Advanced Analytics | ❌ | ✅ |
| Priority Support | ❌ | ✅ |

---

**Built with ❤️ for healthier living**

🥗 NutriLife - Your AI-Powered Health Companion
