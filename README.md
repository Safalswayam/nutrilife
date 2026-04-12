<div align="center">

```
███╗   ██╗██╗   ██╗████████╗██████╗ ██╗██╗     ██╗███████╗███████╗
████╗  ██║██║   ██║╚══██╔══╝██╔══██╗██║██║     ██║██╔════╝██╔════╝
██╔██╗ ██║██║   ██║   ██║   ██████╔╝██║██║     ██║█████╗  █████╗
██║╚██╗██║██║   ██║   ██║   ██╔══██╗██║██║     ██║██╔══╝  ██╔══╝
██║ ╚████║╚██████╔╝   ██║   ██║  ██║██║███████╗██║██║     ███████╗
╚═╝  ╚═══╝ ╚═════╝    ╚═╝   ╚═╝  ╚═╝╚═╝╚══════╝╚═╝╚═╝     ╚══════╝
```

### **AI-Powered Health & Nutrition Platform**
*Full-stack web application · Subscription SaaS · Production-ready*

---

![Next.js](https://img.shields.io/badge/Next.js_15-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL_8.0-4479A1?style=flat-square&logo=mysql&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python_3.11-3776AB?style=flat-square&logo=python&logoColor=white)
![Razorpay](https://img.shields.io/badge/Razorpay-02042B?style=flat-square&logo=razorpay&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI_GPT--4o-412991?style=flat-square&logo=openai&logoColor=white)

</div>

---

## Overview

NutriLife is a production-grade, AI-powered nutrition and health tracking web application built for modern users who demand intelligence, precision, and simplicity in managing their wellness. It combines computer vision–based food recognition, conversational AI health advisory, personalized meal planning, and a structured subscription model into a single cohesive platform.

Built on **Next.js** (frontend), **FastAPI** (backend), and **MySQL** (database), NutriLife is designed for real-world deployment — not just demonstration. Every feature from the Razorpay payment integration to the Telegram admin notification bot is production-ready and environment-configurable.

---

## Table of Contents

- [Feature Highlights](#feature-highlights)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Security Model](#security-model)
- [Deployment](#deployment)
- [Testing Guide](#testing-guide)
- [Roadmap](#roadmap)
- [Troubleshooting](#troubleshooting)

---

## Feature Highlights

### Subscription & Monetization

NutriLife implements a fully functional SaaS subscription system powered by Razorpay, with three pricing tiers optimized for the Indian market.

| Plan | Price | Savings | Highlight |
|------|-------|---------|-----------|
| 3-Month | ₹299 | — | Best for trying premium |
| 6-Month | ₹549 | ₹49 | ⭐ Most Popular |
| 1-Year | ₹849 | ₹347 | 🔥 Best Value |

The pricing UI displays dynamic monthly-equivalent rates, savings percentages, and animated plan cards with hover interactions. Payment is processed through Razorpay, supporting UPI, credit/debit cards, and net banking. Subscription activation occurs atomically via a MySQL stored procedure, and a webhook handler verifies Razorpay signatures before granting premium access.

---

### Free vs Premium Access Control

Access control is enforced at both the **frontend** and **backend** layers — frontend UI gating alone is insufficient for a production system, so every premium API endpoint validates subscription status server-side via middleware.

**Free Tier**
- Water intake tracking with 7-day history
- Basic dashboard (calorie and macro overview)
- Manual food and calorie logging
- Profile and health goal management
- Fasting tracker (16:8, 5:2, OMAD, and more)

**Premium Tier**
- AI Food Analyzer — image-based nutrition detection via GPT-4o Vision
- AI Diet Planner — personalized 7-day meal plans based on BMI, BMR, and TDEE
- AI Health Assistant — conversational wellness and symptom advisor (GPT-4o mini)
- Advanced analytics and nutrition insights
- Priority customer support via Telegram

Locked premium features display a blurred UI overlay with a contextual upgrade modal, giving users a clear preview of what they are missing rather than a blank error state.

---

### AI Food Analysis

Users upload or photograph a meal, and NutriLife sends the image to the **OpenAI GPT-4o Vision API** with a structured prompt that instructs the model to identify individual food items, assign confidence scores, and return per-item caloric and macronutrient data as a JSON payload. The result is rendered as an itemized nutritional breakdown card in the UI.

The system handles ambiguous dishes, composite meals, and Indian regional cuisine by prompting the model with explicit portion-size estimation instructions, making it significantly more versatile than barcode-only logging approaches.

---

### AI Health Assistant

A conversational chatbot powered by **GPT-4o mini** allows users to describe symptoms, ask nutrition questions, or request wellness check-ins in natural language. The chatbot features:

- **Chat tab** — open-ended conversational interaction
- **Wellness tab** — structured health check-in with guided prompts
- **History tab** — chronological conversation log
- **Quick Symptoms panel** — one-tap symptom categories (digestive, mental health, pain, common)
- **Message feedback buttons** — thumbs up / thumbs down for response quality rating

---

### Water Intake Tracker

The water tracker is a real-time, animated component with no page reloads. Features include:

- Animated glass-filling visualization with wave effect
- Circular progress ring with color transitions (blue → green at goal)
- Goal reached celebration animation
- Editable daily goal (1–20 glasses) via settings modal
- Optimistic UI updates — the count changes instantly, then syncs to the backend
- 7-day history chart
- Automatic daily reset at midnight based on the user's local timezone

---

### Google OAuth Authentication

NutriLife supports both email/password and Google OAuth 2.0 login flows. The Google flow uses the official Google Identity Services SDK on the frontend and verifies the received `id_token` against Google's token verification endpoint on the backend before issuing a NutriLife JWT.

Key behaviors:
- New Google users are auto-registered on first sign-in
- Existing email users who sign in with the same Google email address have their accounts automatically linked
- Profile picture, display name, and Google ID are synced on every login
- "Welcome back" vs "Welcome" messaging distinguishes returning from new users

---

### Email OTP Verification

Email-based registration enforces a **6-digit OTP verification step** before account activation. The system attempts delivery via three providers in priority order:

1. **Resend** (preferred — if `RESEND_API_KEY` is configured)
2. **Brevo SMTP** (fallback — if Brevo credentials are configured)
3. **Direct SMTP** (last resort — generic SMTP credentials)

OTP codes expire after 15 minutes. A resend option is available after the initial code is sent. The account row is created in a `pending_verification` state and is only promoted to `active` after a valid code is submitted, preventing incomplete registrations from cluttering the users table.

---

### Telegram Admin Notification Bot

A background notification system sends real-time admin alerts to the `@NUTRILIFEDIET` Telegram channel for the following events:

- New user registered via email
- New user registered via Google OAuth
- New premium subscription activated
- User feedback submitted via the in-app Feedback Widget
- Server startup confirmation

All notifications are dispatched asynchronously using Python's `threading` module so they never block the main FastAPI request-response cycle. The bot is configurable via `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` environment variables and fails silently if unconfigured.

---

### Support System & Feedback Widget

**Support Center** — A tabbed page (`/support`) with:
- Categorized FAQ accordion (Login, Subscription, AI Features, Water Tracking & Fasting)
- Structured bug report template
- Latest release announcements feed

**Feedback Widget** — A persistent floating action button rendered on every authenticated page via the app shell. Users can submit open-ended feedback at any time. Submissions are routed to `/api/feedback` and forwarded to the admin Telegram channel via `notify_feedback()`. The widget auto-hides during page scroll and reappears on idle to minimize UI interference.

**Terms & Conditions** — A dedicated `/terms` page with six accordion sections: Eligibility & Accounts, Features & Access Tiers, Subscription & Payments, Data & Privacy, AI & Health Disclaimer, and Prohibited Use & Liability.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER                       │
│                                                             │
│  Next.js 15  ·  TypeScript  ·  Tailwind CSS  ·  shadcn/ui  │
│  Recharts  ·  React Context API  ·  Google Identity SDK     │
└───────────────────────────┬─────────────────────────────────┘
                            │  HTTPS / REST
┌───────────────────────────▼─────────────────────────────────┐
│                      FASTAPI BACKEND                        │
│                                                             │
│  JWT Auth Middleware  ·  Subscription Middleware            │
│  Routes: auth · food-log · food-analysis · diet-plan        │
│          fasting · water · subscription · payment           │
│          feedback · health · telegram                       │
│  Services: OpenAI · Razorpay · Telegram · Email OTP         │
└────────────┬──────────────────────────┬─────────────────────┘
             │                          │
┌────────────▼────────┐    ┌────────────▼────────────────────┐
│   MySQL 8.0 (RDS)   │    │        EXTERNAL SERVICES        │
│                     │    │                                 │
│  users              │    │  OpenAI GPT-4o (food analysis)  │
│  meal_logs          │    │  OpenAI GPT-4o mini (chatbot)   │
│  food_items         │    │  Google OAuth 2.0               │
│  fasting_sessions   │    │  Razorpay (payments)            │
│  water_logs         │    │  Resend / Brevo (email OTP)     │
│  subscription_plans │    │  Telegram Bot API               │
│  user_subscriptions │    │                                 │
│  payment_txns       │    └─────────────────────────────────┘
│  user_goals         │
│  user_settings      │
└─────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend Framework | Next.js 15 (App Router) | SSR, file-based routing, image optimization |
| Language (Frontend) | TypeScript | Type safety across all components |
| Styling | Tailwind CSS + shadcn/ui | Utility-first UI with accessible primitives |
| Charts | Recharts | Macronutrient and progress visualizations |
| Backend Framework | FastAPI (Python 3.11) | Async REST API with auto-generated OpenAPI docs |
| Database | MySQL 8.0 | Relational data store with stored procedures |
| ORM | SQLAlchemy 2.0 + PyMySQL | Connection pooling and schema management |
| Authentication | JWT + Google OAuth 2.0 | Stateless sessions with social login |
| AI — Food Analysis | OpenAI GPT-4o Vision | Image-to-nutrition extraction |
| AI — Health Chat | OpenAI GPT-4o mini | Conversational health advisory |
| Payments | Razorpay | UPI, cards, net banking for Indian market |
| Email OTP | Resend / Brevo / SMTP | Multi-provider OTP delivery with fallback |
| Notifications | Telegram Bot API | Real-time admin alerts |
| Deployment | Render (backend) · Vercel (frontend) | Cloud hosting with environment variables |

---

## Getting Started

### Prerequisites

- Python 3.10 or higher
- Node.js 18 or higher
- MySQL 8.0
- A Google Cloud project with OAuth 2.0 credentials
- An OpenAI API key
- A Razorpay account (for payment features)

---

### 1. Database Setup

```bash
# Connect to MySQL
mysql -u root -p

# Create database
CREATE DATABASE nutrilife_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit;

# Run the full schema
mysql -u root -p nutrilife_db < api/database_schema.sql

# Verify tables were created
mysql -u root -p -e "USE nutrilife_db; SHOW TABLES;"
```

---

### 2. Backend Setup

```bash
cd api

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # macOS / Linux
venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment variables
cp ../.env.example .env
# Open .env and fill in your credentials (see Environment Configuration below)

# Start the development server
uvicorn index:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`. Interactive API documentation is auto-generated at `http://localhost:8000/docs`.

---

### 3. Frontend Setup

```bash
# From the project root
npm install

# Copy and configure environment variables
cp .env.example .env.local
# Open .env.local and fill in your credentials

# Start the development server
npm run dev
```

The application will be available at `http://localhost:3000`.

---

### 4. Google OAuth Setup

1. Open [Google Cloud Console](https://console.cloud.google.com) and create or select a project
2. Navigate to **APIs & Services → OAuth consent screen** and configure your app
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Set **Authorized JavaScript Origins:**
   ```
   http://localhost:3000
   https://your-production-domain.com
   ```
5. Set **Authorized Redirect URIs** if using server-side flow
6. Copy the **Client ID** and add it to both `.env` (`GOOGLE_CLIENT_ID`) and `.env.local` (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`)

---

## Environment Configuration

### Backend — `.env`

```env
# ── Database ──────────────────────────────────────────────
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=nutrilife_db

# ── Authentication ────────────────────────────────────────
JWT_SECRET_KEY=your_long_random_secret_key_minimum_32_chars
JWT_ALGORITHM=HS256
JWT_EXPIRY_DAYS=30
GOOGLE_CLIENT_ID=your_google_oauth_client_id

# ── AI Services ──────────────────────────────────────────
OPENAI_API_KEY=sk-...

# ── Payments ──────────────────────────────────────────────
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=your_razorpay_secret

# ── Email OTP (priority order: Resend → Brevo → SMTP) ────
RESEND_API_KEY=re_...                    # Option 1: Resend
BREVO_API_KEY=xkeysib-...               # Option 2: Brevo
SMTP_HOST=smtp.gmail.com                # Option 3: Generic SMTP
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# ── Telegram Admin Bot ────────────────────────────────────
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=@NUTRILIFEDIET         # or numeric chat ID

# ── Server ────────────────────────────────────────────────
PORT=8000
CORS_ORIGINS=http://localhost:3000,https://your-production-domain.com
```

### Frontend — `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

> **Security Note:** Never commit `.env` or `.env.local` to version control. Both files are already listed in `.gitignore`.

---

## API Reference

### Authentication

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| `POST` | `/api/auth/register` | ✗ | Register with email and password (sends OTP) |
| `POST` | `/api/auth/verify-email` | ✗ | Submit OTP to activate account |
| `POST` | `/api/auth/resend-verification` | ✗ | Resend OTP to email |
| `POST` | `/api/auth/login` | ✗ | Email/password login |
| `POST` | `/api/auth/google` | ✗ | Google OAuth login / registration |
| `GET` | `/api/auth/me` | ✓ | Get current authenticated user |
| `PUT` | `/api/auth/profile` | ✓ | Update profile information |

### Food Logging

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| `GET` | `/api/food-log/today` | ✓ | Today's meal log with nutritional totals |
| `POST` | `/api/food-log/add` | ✓ | Add a food item to the log |
| `DELETE` | `/api/food-log/{id}` | ✓ | Remove a food item from the log |
| `GET` | `/api/food-log/history` | ✓ | Historical meal log entries |
| `GET` | `/api/food-log/export` | ✓ | Export meal log as CSV |

### AI Features (Premium)

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| `POST` | `/api/analyze-food` | ✓ Premium | Upload food image for AI nutrition analysis |
| `POST` | `/api/diet-plan/generate` | ✓ Premium | Generate personalized 7-day meal plan |
| `GET` | `/api/diet-plan/saved` | ✓ Premium | Retrieve saved diet plans |
| `POST` | `/api/health-assistant/chat` | ✓ Premium | Send message to AI health chatbot |
| `GET` | `/api/health-assistant/history` | ✓ Premium | Retrieve chat history |

### Subscription & Payments

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| `GET` | `/api/subscription/plans` | ✗ | List all available subscription plans |
| `GET` | `/api/subscription/my-subscription` | ✓ | Get current user's subscription status |
| `POST` | `/api/payment/create-order` | ✓ | Create Razorpay payment order |
| `POST` | `/api/payment/verify` | ✓ | Verify payment and activate subscription |
| `POST` | `/api/subscription/cancel` | ✓ | Cancel active subscription |
| `POST` | `/api/subscription/webhook` | ✗ | Razorpay webhook endpoint |
| `GET` | `/api/subscription/feature-access/{feature}` | ✓ | Check access to a specific feature |

### Water Tracking

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| `GET` | `/api/water/today` | ✓ | Today's water intake |
| `POST` | `/api/water/adjust` | ✓ | Add or remove a glass |
| `POST` | `/api/water/set-goal` | ✓ | Update daily glass goal |
| `GET` | `/api/water/history` | ✓ | 7-day water intake history |

### Fasting Tracker

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| `POST` | `/api/fasting/start` | ✓ | Start a fasting session |
| `POST` | `/api/fasting/stop` | ✓ | End the active fasting session |
| `GET` | `/api/fasting/active` | ✓ | Get current active session |
| `GET` | `/api/fasting/history` | ✓ | Historical fasting sessions |

### Utilities

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| `POST` | `/api/feedback` | ✓ | Submit user feedback |
| `GET` | `/api/health` | ✗ | Server health check |

---

## Database Schema

### Core Tables

```sql
-- Users with subscription and OAuth fields
CREATE TABLE users (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255),                        -- NULL for OAuth-only accounts
    google_id       VARCHAR(255) UNIQUE,
    profile_image   VARCHAR(500),
    is_premium      BOOLEAN DEFAULT FALSE,
    subscription_expires_at DATETIME,
    is_verified     BOOLEAN DEFAULT FALSE,
    verification_code VARCHAR(10),
    verification_expires_at DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME ON UPDATE CURRENT_TIMESTAMP
);

-- Subscription plan definitions
CREATE TABLE subscription_plans (
    id              INT PRIMARY KEY,
    name            VARCHAR(50) NOT NULL,
    duration_months INT NOT NULL,
    base_price      DECIMAL(10,2) NOT NULL,
    final_price     DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    badge           VARCHAR(50),                         -- 'Popular', 'Best Value', etc.
    features        JSON
);

-- Active and historical subscriptions
CREATE TABLE user_subscriptions (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    user_id         INT NOT NULL,
    plan_id         INT NOT NULL,
    status          ENUM('active', 'expired', 'cancelled') DEFAULT 'active',
    start_date      DATETIME NOT NULL,
    end_date        DATETIME NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
);

-- Payment transaction records
CREATE TABLE payment_transactions (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    user_id         INT NOT NULL,
    subscription_id INT,
    amount          DECIMAL(10,2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'INR',
    payment_status  ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
    razorpay_order_id   VARCHAR(255),
    razorpay_payment_id VARCHAR(255) UNIQUE,
    gateway_response    JSON,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Stored Procedures

```sql
-- Atomically activate subscription and set user premium flag
CALL activate_subscription(user_id, plan_id, transaction_id);

-- Expire subscriptions past their end_date (run daily via Event Scheduler)
CALL expire_subscriptions();
```

### Automated Jobs

MySQL Event Scheduler is configured to call `expire_subscriptions()` daily at midnight, automatically setting `is_premium = FALSE` and `status = 'expired'` for any subscription whose `end_date` has passed.

---

## Security Model

### Authentication Layer
- JWT tokens signed with `HS256` and a minimum 32-character secret key
- Token expiry: 30 days (configurable via `JWT_EXPIRY_DAYS`)
- Google OAuth tokens verified against Google's public key endpoint before any account action is taken
- Passwords hashed with `bcrypt` (work factor 12)
- Email-based registration requires OTP verification before account activation
- IP address logged on every registration event

### Authorization Layer
- Every protected endpoint declares a `get_current_user` FastAPI dependency that validates the JWT and rejects expired or tampered tokens with HTTP 401
- Premium endpoints additionally check `user.is_premium` and `subscription_expires_at > NOW()` via the subscription middleware
- Feature access decisions are made server-side — frontend gating is a UX courtesy, not a security control

### Data Layer
- All database queries use SQLAlchemy parameterized statements (SQL injection prevention)
- Pydantic models validate and coerce all incoming request data before it reaches any business logic
- Foreign key constraints enforce referential integrity across all related tables
- Razorpay webhooks are verified using HMAC-SHA256 signature validation before any subscription state is modified

### API Layer
- CORS origins are explicitly allowlisted via the `CORS_ORIGINS` environment variable
- All endpoints return structured error responses with appropriate HTTP status codes
- Sensitive fields (password hashes, verification codes) are never included in API responses

---

## Deployment

### Production Checklist

**Environment**
- [ ] `DEBUG=False` in production
- [ ] Strong `JWT_SECRET_KEY` (minimum 64 random characters)
- [ ] All environment variables set in hosting platform secrets manager
- [ ] CORS origins restricted to production domains only

**Infrastructure**
- [ ] HTTPS enabled with valid SSL certificate
- [ ] Database hosted on managed service (AWS RDS, Google Cloud SQL, or PlanetScale)
- [ ] Database backups configured (daily minimum)
- [ ] Connection pooling configured (pool size ≥ 10)

**Payments**
- [ ] Razorpay switched to live keys (`rzp_live_*`)
- [ ] Razorpay webhook URL configured and verified
- [ ] Webhook signature verification tested end-to-end

**Monitoring**
- [ ] Error tracking configured (Sentry recommended)
- [ ] Server health endpoint monitored (`/api/health`)
- [ ] Telegram admin bot connected and receiving startup notification

---

### Recommended Hosting

| Component | Recommended Platform | Notes |
|-----------|---------------------|-------|
| Frontend (Next.js) | **Vercel** | Native Next.js support, zero-config deployment |
| Backend (FastAPI) | **Render** | `uvicorn index:app --host 0.0.0.0 --port $PORT` |
| Database (MySQL) | **PlanetScale** or **AWS RDS** | Managed backups, scaling |
| Media Storage | **Cloudflare R2** or **AWS S3** | For profile images |

**Render deployment command:**
```bash
uvicorn index:app --host 0.0.0.0 --port $PORT
```
> Render supplies `$PORT` dynamically. Hardcoding a port number will cause deployment failures.

---

## Testing Guide

### Subscription Flow
1. Navigate to `/subscription`
2. Select a plan and click subscribe
3. Complete payment through the Razorpay modal
4. Verify that premium features unlock immediately after payment
5. Confirm record in `payment_transactions` and `user_subscriptions` tables

### Feature Access Control
1. Log in with a free account (no active subscription)
2. Navigate to `/food-analysis`
3. Confirm the premium gate overlay appears with an upgrade modal
4. Subscribe to any plan
5. Return to `/food-analysis` and confirm full access is granted

### Google OAuth Flow
1. Click "Sign in with Google" on the login page
2. Complete Google account selection
3. Verify automatic account creation and redirect to `/onboarding`
4. Sign out and sign in again — confirm "Welcome back" message and no duplicate account

### Email OTP Flow
1. Register with a real Gmail address
2. Check inbox for the 6-digit OTP (check spam if not received within 2 minutes)
3. Enter OTP on the verification screen
4. Confirm account is activated and redirected to `/onboarding`
5. Test resend: click "Resend code" and verify a new OTP arrives and the previous one is invalidated

### Database Verification Queries

```sql
-- Active subscriptions with plan and user details
SELECT u.email, sp.name AS plan, us.status, us.end_date
FROM users u
JOIN user_subscriptions us ON u.id = us.user_id
JOIN subscription_plans sp ON us.plan_id = sp.id
ORDER BY us.created_at DESC;

-- Recent payment transactions
SELECT user_id, amount, payment_status, razorpay_payment_id, created_at
FROM payment_transactions
ORDER BY created_at DESC
LIMIT 20;

-- Daily water intake summary
SELECT user_id, log_date, SUM(glasses) AS total_glasses
FROM water_logs
GROUP BY user_id, log_date
ORDER BY log_date DESC;

-- Users pending email verification
SELECT id, name, email, created_at
FROM users
WHERE is_verified = FALSE AND verification_expires_at > NOW();
```

---

## Roadmap

Items currently planned or under active consideration for future releases.

| Priority | Feature | Description |
|----------|---------|-------------|
| High | Email notifications | Subscription renewal reminders, weekly nutrition summaries |
| High | Admin dashboard | Web UI for managing users, subscriptions, and feedback |
| High | Hindi / i18n support | Next.js i18n routing for regional language accessibility |
| Medium | Mobile app (React Native) | Native iOS and Android with camera-based food scanning |
| Medium | Community food diary | Social sharing of meal plans and nutritional achievements |
| Medium | Clinical nutritionist portal | Dietitian access for prescribing therapeutic meal plans |
| Medium | Subscription auto-renewal | Razorpay recurring payment integration |
| Low | PDF report export | Downloadable weekly nutrition and fasting reports |
| Low | CGM integration | Continuous glucose monitor data for glycemic feedback |
| Low | Referral program | Invite-based discount on subscription plans |
| Low | Family plans | Shared premium subscription for multiple household members |

---

## Troubleshooting

### Google login returns an error

Verify that the `GOOGLE_CLIENT_ID` in your `.env` matches exactly the Client ID in Google Cloud Console. Check that `http://localhost:3000` is listed under **Authorized JavaScript Origins**. Clear the browser cache and try again. If the issue persists, confirm that the Google+ API (or Google Identity API) is enabled for your project.

### Subscription not activating after payment

Check the `payment_transactions` table for a record with the Razorpay payment ID. If the record exists but `payment_status` is still `pending`, the webhook may not have fired — verify the webhook URL is correctly configured in the Razorpay dashboard and that the signature verification is passing. If no record exists, the order creation step may have failed; check the backend logs for Razorpay API errors.

### Premium features still locked after subscribing

Confirm that `users.is_premium = TRUE` and `users.subscription_expires_at > NOW()` for the affected user. If the database values are correct but the frontend still shows the gate, clear `localStorage` and log in again — the JWT may contain a cached non-premium claim that was issued before the subscription activated.

### Email OTP not received

Check the spam/junk folder first. If using Resend, verify the `RESEND_API_KEY` is valid and the sending domain is verified in the Resend dashboard. If using Brevo or SMTP, check that the SMTP credentials are correct and that the sending account has not triggered any spam filters. OTP codes expire after 15 minutes — if the code has expired, use the "Resend code" option to generate a fresh one.

### Water intake not updating

Open the browser developer console and check for network errors on the `/api/water/adjust` request. Common causes include an expired JWT token (log out and back in), a lost database connection (check backend logs), or an ad blocker interfering with API calls. Verify the backend is running and reachable at `NEXT_PUBLIC_API_URL`.

### Render deployment fails with port error

The startup command must use `$PORT`, not a hardcoded port number. Render injects `$PORT` as an environment variable at runtime:

```bash
# Correct
uvicorn index:app --host 0.0.0.0 --port $PORT

# Incorrect — will cause deployment failure
uvicorn index:app --host 0.0.0.0 --port 8000
```

---

## Project Structure

```
nutrilife/
│
├── api/                                  # FastAPI backend
│   ├── index.py                          # Application entry point, all routes
│   ├── database_schema.sql               # Complete MySQL schema with stored procedures
│   ├── requirements.txt                  # Python dependencies
│   ├── render.yaml                       # Render deployment configuration
│   ├── runtime.txt                       # Python version pin
│   │
│   ├── google_auth_service.py            # Google OAuth token verification
│   ├── middleware_subscription.py        # Premium feature access control
│   ├── models_auth.py                    # Pydantic auth request/response models
│   ├── models_subscription.py            # Pydantic subscription models
│   ├── routes_google_auth.py             # Google OAuth API routes
│   ├── routes_subscription.py            # Subscription and plan routes
│   ├── routes_water.py                   # Water tracking routes
│   ├── routes_webhook.py                 # Razorpay webhook handler
│   ├── subscription_service.py           # Subscription business logic
│   └── telegram_notifier.py             # Async admin notification bot
│
├── app/                                  # Next.js App Router pages
│   ├── dashboard/page.tsx                # Main dashboard
│   ├── food-log/page.tsx                 # Food logging module
│   ├── food-analysis/page.tsx            # AI food image analysis (Premium)
│   ├── diet-planner/page.tsx             # AI meal plan generator (Premium)
│   ├── health-assistant/page.tsx         # AI chatbot (Premium)
│   ├── fasting-tracker/page.tsx          # Intermittent fasting tracker
│   ├── subscription/page.tsx             # Pricing and subscription management
│   ├── support/page.tsx                  # Support center and Telegram hub
│   ├── telegram/page.tsx                 # Telegram community page
│   ├── terms/page.tsx                    # Terms and Conditions
│   ├── profile/page.tsx                  # Profile and settings
│   ├── login/page.tsx                    # Login page
│   ├── signup/page.tsx                   # Registration with OTP verification
│   ├── onboarding/page.tsx               # New user onboarding flow
│   ├── layout.tsx                        # Root layout with app shell
│   └── globals.css                       # Global styles
│
├── components/                           # Reusable React components
│   ├── app-shell.tsx                     # Navigation and Feedback Widget host
│   ├── feedback-widget.tsx               # Floating feedback button
│   ├── page-header.tsx                   # Consistent page header
│   ├── water-intake-widget.tsx           # Animated water tracker
│   └── ui/                              # shadcn/ui component library
│
├── lib/
│   ├── auth-context.tsx                  # Authentication state and methods
│   ├── api.ts                            # API utility functions
│   └── utils.ts                          # General utilities
│
├── public/                               # Static assets
│   ├── nutrilife-icon.png
│   ├── hero-food-plate.png
│   └── healthy-lifestyle-bg.png
│
├── .env.example                          # Environment variable template
├── .env.local                            # Local frontend environment (not committed)
├── next.config.mjs                       # Next.js configuration
├── tailwind.config.ts                    # Tailwind CSS configuration
├── tsconfig.json                         # TypeScript configuration
├── package.json                          # Frontend dependencies
├── INTEGRATION_GUIDE.md                  # Step-by-step integration guide
└── README.md                             # This file
```

---

<div align="center">

---

*NutriLife — Built with precision for healthier living*

**Next.js · FastAPI · MySQL · OpenAI · Razorpay · Tailwind CSS**

</div>
