"use client"

import React, { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  MessageCircle, Search, CreditCard, LogIn, Brain, Droplets,
  ChevronDown, ChevronUp, Send, ExternalLink, Clock,
  CheckCircle, Copy, ClipboardList, Bell, Shield, Zap, Radio, ChevronRight,
} from "lucide-react"
import { toast } from "sonner"

const TELEGRAM_LINK = "https://t.me/NUTRILIFEDIET"

interface FAQ { q: string; a: string | React.ReactNode }
interface FAQCategory { id: string; icon: React.ElementType; title: string; color: string; faqs: FAQ[] }

const faqCategories: FAQCategory[] = [
  {
    id: "login", icon: LogIn, title: "Login & Authentication", color: "text-blue-500",
    faqs: [
      { q: "Google Sign-In is not working.", a: "Try these steps: (1) Make sure you're using the same Google account as before. (2) Clear your browser cache and try again. (3) Check if your browser is blocking pop-ups. (4) Ensure Google+ API is not blocked in your region. If still failing, DM support with a screenshot." },
      { q: "I forgot my password.", a: "Use the 'Forgot Password' option on the login page. A reset link will be sent to your registered email. Check your spam folder if you don't see it." },
      { q: "I'm logged out every time I open the app.", a: "Sessions expire after 30 days for security. Simply log in again. If it's happening too frequently, clear your browser's local storage and re-login." },
      { q: "Can I link my email account to Google?", a: "Yes — log in with Google using the same email address. The system will automatically link your accounts. You'll see a 'Welcome back' message confirming the link." },
      { q: "I have two accounts and can't merge them.", a: "Contact support with both email addresses. We'll help merge your accounts and transfer your data manually." },
    ],
  },
  {
    id: "subscription", icon: CreditCard, title: "Subscription & Payments", color: "text-green-500",
    faqs: [
      { q: "I paid but premium features are still locked.", a: "Try these steps: (1) Log out and log back in. (2) Go to Profile → Subscription to check status. (3) Clear localStorage in browser settings and re-login. If still locked after 30 minutes, DM support with your payment transaction ID." },
      { q: "My payment failed but money was deducted.", a: "This can happen due to bank processing delays. The amount is usually auto-refunded within 5–7 business days. If not, contact your bank and share the Razorpay transaction ID with our support team." },
      { q: "How do I cancel my subscription?", a: "Go to Profile → Subscription → Cancel Subscription. Your access continues until the current plan period ends. No data will be lost." },
      { q: "Can I get a refund?", a: "We do not offer refunds for partially used subscription periods, as stated in our Terms & Conditions (Section 3). For exceptional cases, contact support." },
      { q: "Can I upgrade or switch plans mid-subscription?", a: "Plan switching is not available mid-cycle. You can subscribe to a different plan after your current one expires." },
      { q: "Which payment methods are accepted?", a: "UPI, Credit Cards, Debit Cards, and Net Banking — all processed securely via Razorpay." },
    ],
  },
  {
    id: "ai", icon: Brain, title: "AI Features", color: "text-purple-500",
    faqs: [
      { q: "AI Food Analyzer gave wrong nutrition values.", a: "AI accuracy depends on image quality. Tips: (1) Use a well-lit, clear photo. (2) Ensure the full dish is visible. (3) Avoid blurry or top-down angles. AI estimates are approximate — always cross-check for medical dietary purposes." },
      { q: "Diet Planner is not generating a meal plan.", a: "Make sure your profile is complete — height, weight, age, goal, and activity level are all required. Incomplete profiles can cause plan generation to fail. Update your profile and try again." },
      { q: "Health Assistant is not responding.", a: "Check your internet connection first. If the issue persists, the AI service may be temporarily unavailable. Wait 15–30 minutes and try again. Check our Telegram channel for service status updates." },
      { q: "Can I save AI-generated meal plans?", a: "Yes — use the Save Plan button inside the Diet Planner. Saved plans appear in your dashboard under the weekly plan section." },
      { q: "The AI recommended something I'm allergic to.", a: "Go to Profile → Preferences and add your dietary restrictions or allergies. The AI will exclude those ingredients in future plans." },
    ],
  },
  {
    id: "tracking", icon: Droplets, title: "Water Tracking & Fasting", color: "text-cyan-500",
    faqs: [
      { q: "My water count reset unexpectedly.", a: "Water intake resets daily at midnight (your local timezone). This is expected behavior. Check the 7-day history to see past data — it's preserved for 7 days." },
      { q: "I set a daily water goal but it reverted.", a: "Make sure you're logged in when setting the goal. Anonymous sessions don't save settings. Log in and set your goal again from the water tracker." },
      { q: "Fasting timer is not starting.", a: "Select a fasting plan (e.g. 16:8, 5:2, OMAD) and tap 'Start Fasting.' If the button is unresponsive, refresh the page and try again. Make sure you don't already have an active session." },
      { q: "My fasting session didn't save to history.", a: "Sessions under 30 minutes are not recorded in history. Complete a session of at least 30 minutes to see it logged." },
      { q: "Can I pause a fasting session?", a: "Currently, pausing is not supported. You can stop and restart a session, but elapsed time won't carry over. Pause support is planned for a future update." },
      { q: "Food log calories are not showing on my dashboard.", a: "The dashboard syncs every few minutes. Pull to refresh or do a hard reload (Ctrl+Shift+R) to see the latest data." },
    ],
  },
]

const REPORT_TEMPLATE = `📝 BUG / ISSUE REPORT

📧 Registered Email: 
📱 Device / Browser: 
🐛 Issue Type: [ Login | Payment | AI Feature | Water/Fasting | Other ]
📄 Description:
(What happened? What did you expect?)

🔁 Steps to Reproduce:
1. 
2. 
3. 

📸 Screenshot: (attach below)
━━━━━━━━━━━━━━━━━━
Send to @NUTRILIFEDIET`

const LATEST_POSTS = [
  { version: "v1.0 — Launch", date: "April 7, 2026", type: "Major Release", typeColor: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", summary: "NutriLife is officially live! AI Food Analyzer, Diet Planner, Health Assistant, Fasting Tracker, Water Tracker, Google OAuth, Razorpay subscriptions and more." },
  { version: "Terms & Conditions", date: "April 7, 2026", type: "Policy", typeColor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", summary: "Our Terms of Service are now live and accessible from within the app. Covers eligibility, subscription terms, AI disclaimer, data privacy, and prohibited use." },
  { version: "Support System Live", date: "April 7, 2026", type: "Announcement", typeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300", summary: "Our Telegram channel @NUTRILIFEDIET is active. DM us for any issues. Response time is within 24 hours, Monday to Saturday." },
]

function FAQItem({ faq }: { faq: FAQ }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-border last:border-0">
      <button className="w-full text-left py-3 flex items-start justify-between gap-3" onClick={() => setOpen(!open)}>
        <span className="text-sm font-medium text-foreground leading-snug">{faq.q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
      </button>
      {open && <div className="pb-3 text-sm text-muted-foreground leading-relaxed pr-4">{faq.a}</div>}
    </div>
  )
}

export default function SupportTelegramPage() {
  const [activeTab, setActiveTab] = useState<"support" | "telegram">("support")
  const [search, setSearch] = useState("")
  const [copied, setCopied] = useState(false)

  const filteredCategories = faqCategories
    .map((cat) => ({ ...cat, faqs: cat.faqs.filter((f) => !search || f.q.toLowerCase().includes(search.toLowerCase()) || (typeof f.a === "string" && f.a.toLowerCase().includes(search.toLowerCase()))) }))
    .filter((cat) => cat.faqs.length > 0)

  const handleCopy = () => {
    navigator.clipboard.writeText(REPORT_TEMPLATE).then(() => {
      setCopied(true)
      toast.success("Report template copied!")
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <PageHeader title="Support & Community" subtitle="Get help or stay connected on Telegram" />

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border">
        {([["support", "Support Center", null], ["telegram", "Telegram", Send]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-2 ${activeTab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {label}
          </button>
        ))}
      </div>

      {/* ── SUPPORT TAB ── */}
      {activeTab === "support" && (
        <div>
          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center"><Send className="w-4 h-4 text-primary" /></div>
                  <p className="text-sm font-semibold text-foreground">Telegram Support</p>
                  <p className="text-xs text-muted-foreground">DM us anytime</p>
                  <a href={TELEGRAM_LINK} target="_blank" rel="noopener noreferrer" className="w-full">
                    <Button size="sm" className="w-full text-xs">@NUTRILIFEDIET <ExternalLink className="w-3 h-3 ml-1" /></Button>
                  </a>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><Clock className="w-4 h-4 text-muted-foreground" /></div>
                  <p className="text-sm font-semibold text-foreground">Response Time</p>
                  <p className="text-xs text-muted-foreground">Within 24 hours</p>
                  <Badge variant="secondary" className="text-xs">Mon – Sat</Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><MessageCircle className="w-4 h-4 text-muted-foreground" /></div>
                  <p className="text-sm font-semibold text-foreground">Updates Channel</p>
                  <p className="text-xs text-muted-foreground">News & announcements</p>
                  <button onClick={() => setActiveTab("telegram")} className="w-full">
                    <Badge variant="outline" className="text-xs w-full justify-center py-1 cursor-pointer hover:bg-muted">View Telegram →</Badge>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search frequently asked questions..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="space-y-4 mb-6">
            {filteredCategories.length === 0 ? (
              <Card><CardContent className="py-10 text-center"><Search className="w-8 h-8 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground text-sm">No results for "{search}"</p></CardContent></Card>
            ) : filteredCategories.map((cat) => {
              const Icon = cat.icon
              return (
                <Card key={cat.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${cat.color}`} />
                      <CardTitle className="text-base">{cat.title}</CardTitle>
                      <Badge variant="secondary" className="text-xs ml-auto">{cat.faqs.length}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>{cat.faqs.map((faq, i) => <FAQItem key={i} faq={faq} />)}</CardContent>
                </Card>
              )
            })}
          </div>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2"><ClipboardList className="w-5 h-5 text-primary" /><CardTitle className="text-base">Report a Bug or Issue</CardTitle></div>
              <CardDescription>Copy this template and send it to @NUTRILIFEDIET on Telegram with a screenshot.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-lg p-4 font-mono text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed mb-3">{REPORT_TEMPLATE}</div>
              <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={handleCopy}>
                {copied ? <><CheckCircle className="w-4 h-4 text-green-500" />Copied!</> : <><Copy className="w-4 h-4" />Copy Template</>}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div><p className="font-semibold text-foreground mb-1">Still need help?</p><p className="text-sm text-muted-foreground">Our support team is ready on Telegram.</p></div>
                <a href={TELEGRAM_LINK} target="_blank" rel="noopener noreferrer">
                  <Button className="flex items-center gap-2 whitespace-nowrap"><Send className="w-4 h-4" />Contact Support<ExternalLink className="w-3 h-3 opacity-70" /></Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TELEGRAM TAB ── */}
      {activeTab === "telegram" && (
        <div>
          <Card className="mb-6 bg-primary/5 border-primary/20">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0"><Send className="w-6 h-6 text-primary" /></div>
                <div className="flex-1">
                  <h2 className="text-base font-bold text-foreground mb-1">Join @NUTRILIFEDIET on Telegram</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">Official source for app updates, Terms of Service changes, support, and announcements. Turn on notifications to stay informed.</p>
                  <a href={TELEGRAM_LINK} target="_blank" rel="noopener noreferrer" className="inline-block mt-3">
                    <Button size="sm" className="flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" />Join Channel<ExternalLink className="w-3 h-3 opacity-70" /></Button>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">What We Post</h3>
          <Card className="mb-6">
            <CardContent className="pt-5">
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { icon: Zap, title: "Feature Releases", desc: "Every new feature or major update", color: "text-amber-500" },
                  { icon: Shield, title: "Security Patches", desc: "When a fix requires action from you", color: "text-red-500" },
                  { icon: Bell, title: "Maintenance Windows", desc: "At least 24 hours before any downtime", color: "text-blue-500" },
                  { icon: MessageCircle, title: "Policy Updates", desc: "When Terms or Privacy Policy are updated", color: "text-green-500" },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.title} className="flex gap-3">
                      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${item.color}`} />
                      <div><p className="text-sm font-medium text-foreground">{item.title}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Latest Announcements</h3>
          <div className="space-y-3 mb-6">
            {LATEST_POSTS.map((post, i) => (
              <Card key={i}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5"><Radio className="w-4 h-4 text-muted-foreground" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-foreground">{post.version}</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${post.typeColor}`}>{post.type}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{post.date}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{post.summary}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Report an Issue</h3>
          <Card className="mb-6">
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground mb-3">When reporting a bug to <span className="font-mono text-foreground">@NUTRILIFEDIET</span>, copy and fill out this template:</p>
              <div className="bg-muted rounded-lg p-4 font-mono text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed mb-3">{REPORT_TEMPLATE}</div>
              <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={handleCopy}>
                {copied ? <><CheckCircle className="w-4 h-4 text-green-500" />Copied!</> : <><Copy className="w-4 h-4" />Copy Template</>}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Quick Links</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-1">
              {[
                { label: "Terms & Conditions", href: "/terms", icon: Shield },
                { label: "Subscription Plans", href: "/subscription", icon: Zap },
                { label: "Support FAQ", href: "#", icon: MessageCircle, action: () => setActiveTab("support") },
              ].map((link) => {
                const Icon = link.icon
                return (
                  <a key={link.label} href={link.href === "#" ? undefined : link.href} onClick={link.action} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors group cursor-pointer">
                    <div className="flex items-center gap-3"><Icon className="w-4 h-4 text-muted-foreground" /><span className="text-sm text-foreground">{link.label}</span></div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </a>
                )
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
