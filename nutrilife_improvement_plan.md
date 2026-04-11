# NutriLife — Customer-Centric Improvement Plan

A full audit of the current app with prioritized, actionable changes to make it more popular and user-friendly.

---

## 🔴 HIGH IMPACT — Do These First

These directly affect whether users stick around or churn.

---

### 1. 🚀 Onboarding Flow is Missing

**Problem:** New users land on the dashboard with no guidance. There is no onboarding wizard, no "welcome" message, and no nudge to complete their profile.

**Current behavior:** User signs up → empty dashboard → confused → leaves.

**Fix:**
- After first signup, redirect to a **3-step onboarding wizard**:
  1. Set your goal (lose / maintain / gain weight)
  2. Enter height, weight, age, activity level
  3. Choose your first fasting plan or get an AI diet plan
- Add a "**Profile Completion Progress Bar**" on the dashboard until the profile is 100% filled.

**Files to change:**
- `app/signup/page.tsx` — redirect to `/onboarding` after signup
- Create new `app/onboarding/page.tsx`
- `app/page.tsx` — add profile completion banner at top of dashboard

---

### 2. 📊 Dashboard Empty State is Depressing

**Problem:** First-time users see zeros everywhere — 0 calories, 0 meals, 0 water. There is nothing to engage with.

**Fix:**
- Show **motivational empty states** with clear CTAs:
  - "Log your first meal → [Food Log]"
  - "Get your personalized diet plan → [Diet Planner]"
  - "Start your first fasting session → [Fasting Tracker]"
- Add a **"Getting Started" card** on first visit (dismissable via localStorage)

**Files to change:**
- `app/page.tsx` — add empty state detection + getting started card

---

### 3. 🔔 No Push Notifications / Reminders

**Problem:** The app has no way to bring users back. There are no meal reminders, water reminders, or fasting reminders.

**Fix:**
- Add **Web Push Notifications** (using the browser Push API) for:
  - Meal time reminders (breakfast/lunch/dinner based on logged meal times)
  - Water intake reminders every 2 hours
  - Fasting window alerts ("2 hours until your fasting window ends!")
- Add a notification settings section in Profile

**Files to change:**
- `app/profile/page.tsx` — add Notifications tab
- Create `lib/push-notifications.ts`
- Backend: add a notification preferences column to the user table

---

### 4. 💬 Health Assistant UX Friction

**Problem:** (From the sidebar) The Health Assistant exists but users have no predefined prompts. New users don't know what to ask, so they abandon it.

**Fix:**
- Add **Quick Starter Prompts** on the health assistant page:
  - "What should I eat for breakfast today?"
  - "How many calories do I need to lose 5kg?"
  - "What foods are high in protein?"
  - "Is intermittent fasting right for me?"
- Show the last 3 conversations in a sidebar panel for quick resume

**Files to change:**
- `app/health-assistant/page.tsx` — add starter prompt chips

---

### 5. 📱 No "Progress" Visualization / History

**Problem:** The app tracks data but never shows meaningful progress over time. Users can't see if they're getting closer to their goals.

**Fix:**
- Add a **Weight Progress Chart** to the dashboard sidebar:
  - Log weight weekly from Profile
  - Show a trend line with target weight marker
- Add **Streak badges** (🔥 5-day streak, 🏆 30-day streak) visible on the dashboard
- Show "You've logged meals for X days in a row!"

**Files to change:**
- `app/page.tsx` — add streak + weight trend widgets
- `app/profile/page.tsx` — add weight log section
- Backend `api/index.py` — add weight history endpoint

---

### 6. 🎯 Subscription Page Lacks Urgency & Social Proof

**Problem:** The subscription page is clean but lacks conversion psychology:
- No user testimonials / social proof
- No "X users subscribed this week" counter
- No urgency (no limited-time offer, no trial)
- "Get Started" CTA is very generic

**Fix:**
- Add **3–5 fake (or real) user testimonials** with photos, names, result ("Lost 8kg in 3 months")
- Add a **"Free 3-day trial"** toggle or trial offer for premium
- Add urgency: "Join 2,000+ users tracking their health with NutriLife Premium"
- Change CTA from "Get Started →" to "Start My Health Journey"

**Files to change:**
- `components/subscription-page.tsx` — add testimonials section
- `app/subscription/page.tsx` — update CTA text + add social proof banner

---

## 🟡 MEDIUM IMPACT — Do These Next

---

### 7. 🍽️ Food Log UX is Unclear

**Problem:** Manual food logging requires knowing exact calories. Most users don't know calorie counts off the top of their head.

**Fix:**
- Show a **search-as-you-type food database** (at least 200 Indian + global foods with pre-filled macros)
- Add a **"Recently Logged"** quick-add section so repeat meals are one tap
- Add a **barcode scanner** (camera-based) placeholder for future feature

**Files to change:**
- `app/food-log/page.tsx` — improve search + recent meals
- Backend: expand the food database in `api/index.py`

---

### 8. 🌙 No Dark Mode Toggle

**Problem:** The app seems to not have an explicit user-facing dark mode toggle — only the system dark mode applies. Many users want to switch manually.

**Fix:**
- Add a **dark/light mode toggle** in the sidebar nav and in Profile settings
- Store the user preference in localStorage

**Files to change:**
- `components/sidebar-nav.tsx` — add theme toggle button
- `lib/theme-context.ts` — if not already handling user preference

---

### 9. 📈 Terms & Support are Not Discoverable

**Problem:** Terms & Support are only findable by scrolling to the bottom of Profile. They are also completely hidden from new/unauthenticated users.

**Fix:**
- Add a **footer bar** with links to Terms, Support, Telegram visible on login/signup pages
- Place "Help & Support" as a visible link in the sidebar nav (not just in Profile)

**Files to change:**
- `components/sidebar-nav.tsx` — add Help link
- `app/login/page.tsx` — add footer with Terms & Support
- `app/signup/page.tsx` — same

---

### 10. 🏆 Gamification Elements are Missing

**Problem:** There's nothing making the app "fun" to return to.

**Fix:**
- Add **milestone badges**: First meal logged, 7-day streak, 1kg lost, first fasting session completed
- Show badges in the Profile page
- Give a "confetti" animation when a daily calorie goal is met

**Files to change:**
- Create `components/achievement-badge.tsx`
- `app/profile/page.tsx` — add Achievements section
- `app/page.tsx` — add confetti when daily goal = 100%

---

### 11. 🔑 No "Forgot Password" Flow

**Problem:** The login page has no Forgot Password link. If a user forgets their email/password login, they're completely stuck.

**Fix:**
- Add a "Forgot Password?" link on the login page
- Backend: add `/api/auth/forgot-password` endpoint that sends a reset email

**Files to change:**
- `app/login/page.tsx` — add "Forgot Password?" link
- Backend `api/index.py` — add reset flow endpoint

---

### 12. 🍱 Diet Planner Results Are Not Shareable

**Problem:** When the AI generates a 7-day meal plan, there's no way to export or share it. Users can't share their plan with a friend or family member.

**Fix:**
- Add an **"Export as PDF"** / print button on the diet planner results page
- Add a **"Share Plan"** feature that generates a read-only link

**Files to change:**
- `app/diet-planner/page.tsx` — add Export/Share buttons

---

## 🟢 LOW IMPACT (but good polish) — Do These Later

---

### 13. 🌐 No Public Landing Page / SEO

**Problem:** The entire app sits behind authentication. There is no public-facing landing page that explains what NutriLife is to non-users. Google can't index it. Users can't share a link.

**Fix:**
- Create a proper `app/landing/page.tsx` at `/` for unauthenticated users
- Move the authenticated dashboard to `/dashboard`
- Include hero section, features, pricing, testimonials, and a CTA

**Files to change:**
- `app/page.tsx` — split into public landing + authenticated dashboard
- `app/layout.tsx` — update routing logic

---

### 14. ⭐ No Feedback / Rating Loop

**Problem:** There is no way to collect user feedback, ratings, or feature requests inside the app.

**Fix:**
- Add a **"Rate your experience"** 1–5 star widget that appears after 7 days of use
- Add a **"Suggest a feature"** Telegram link in Support

**Files to change:**
- `app/support/page.tsx` — add feature request section
- `components/feedback-widget.tsx` — new component

---

### 15. ♿ Accessibility Gaps

**Problem:** Several interactive elements lack proper ARIA labels (e.g., the water +/- buttons, camera/switch buttons on food analysis).

**Fix:**
- Audit all button elements for `aria-label`
- Make sure all inputs have associated `<label>` elements
- Test keyboard navigation order

**Files to change:**
- `components/enhanced-water-intake.tsx`
- `app/food-analysis/page.tsx`
- `components/sidebar-nav.tsx`

---

## 📊 Priority Order Summary

| Priority | Change | Effort | Impact |
|----------|--------|--------|--------|
| 🔴 1 | Onboarding wizard | High | Very High |
| 🔴 2 | Dashboard empty state CTAs | Low | High |
| 🔴 3 | Push notifications / reminders | High | Very High |
| 🔴 4 | Health assistant starter prompts | Low | High |
| 🔴 5 | Progress visualization / streaks | Medium | High |
| 🔴 6 | Subscription social proof + urgency | Low | High |
| 🟡 7 | Food log search UX | Medium | Medium |
| 🟡 8 | Dark mode toggle | Low | Medium |
| 🟡 9 | Support/Help discoverability | Low | Medium |
| 🟡 10 | Gamification / badges | Medium | Medium |
| 🟡 11 | Forgot password | Medium | Medium |
| 🟡 12 | Diet plan export/share | Medium | Medium |
| 🟢 13 | Public landing page + SEO | High | Long-term |
| 🟢 14 | Feedback/rating loop | Low | Long-term |
| 🟢 15 | Accessibility audit | Medium | Long-term |

---

## 🎯 Quick Wins You Can Do Today (< 2 hours each)

1. **Add starter prompts** to the Health Assistant page — 30 min
2. **Add "Getting Started" card** on the empty dashboard — 45 min
3. **Update subscription CTAs** ("Start My Health Journey" + add one testimonial) — 30 min
4. **Add Forgot Password link** to login page (even if it just links to Telegram for now) — 15 min
5. **Add Help link** to sidebar navigation — 10 min
6. **Add dark mode toggle** button in sidebar — 30 min
