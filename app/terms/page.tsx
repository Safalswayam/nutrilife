"use client"

import React, { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Shield,
  User,
  CreditCard,
  Lock,
  Brain,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Send,
  Check,
  Star,
} from "lucide-react"
import { cn } from "@/lib/utils"

const EFFECTIVE_DATE = "April 7, 2026"
const TELEGRAM_LINK = "https://t.me/NUTRILIFEDIET"

interface Section {
  id: string
  icon: React.ElementType
  title: string
  badge?: string
  content: React.ReactNode
}

const sections: Section[] = [
  {
    id: "eligibility",
    icon: User,
    title: "Eligibility & Accounts",
    content: (
      <div className="space-y-4">
        <div>
          <h4 className="font-semibold text-foreground mb-1">1.1 Age Requirement</h4>
          <p className="text-muted-foreground text-sm leading-relaxed">
            You must be 13 years or older to use NutriLife. By creating an account, you confirm you meet this
            requirement. Users under 18 should have parental consent.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-1">1.2 Account Registration</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>You may register via Email/Password or Google OAuth.</li>
            <li>You are responsible for keeping your credentials secure.</li>
            <li>One account per person — duplicate accounts may be removed.</li>
            <li>Do not share your login credentials with anyone.</li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-1">1.3 Account Accuracy</h4>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Provide accurate information (name, health goals, dietary preferences). Inaccurate data may affect
            AI-generated recommendations.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-1">1.4 Account Termination</h4>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We reserve the right to suspend or terminate accounts that violate these Terms, misuse AI features,
            or engage in fraudulent activity.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "features",
    icon: FileText,
    title: "Features & Access Tiers",
    content: (
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className="text-xs">Free Plan</Badge>
            </div>
            <ul className="text-sm text-muted-foreground space-y-2">
              {[
                "Water intake tracking (daily goal + 7-day history)",
                "Basic dashboard (calories, macros overview)",
                "Manual food & calorie logging",
                "Food log with 50+ Indian & global foods",
                "Fasting tracker (16:8, 5:2, OMAD & more)",
                "Profile & health goal management",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-primary/40 rounded-xl p-4 bg-primary/5">
            <div className="flex items-center gap-2 mb-3">
              <Badge className="text-xs bg-primary text-primary-foreground">Premium Plan</Badge>
            </div>
            <ul className="text-sm text-muted-foreground space-y-2">
              {[
                "AI Food Analyzer — image-based nutrition detection",
                "AI Diet Planner — personalized 7-day meal plans",
                "Health Assistant AI — chat-based nutrition advisor",
                "Advanced analytics & insights",
                "Priority customer support",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Star className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-[color:var(--warning)] shrink-0 mt-0.5" />
          <span>Attempting to bypass or circumvent subscription access controls is a violation of these Terms and
          may result in account suspension.</span>
        </p>
      </div>
    ),
  },
  {
    id: "subscription",
    icon: CreditCard,
    title: "Subscription & Payments",
    badge: "Important",
    content: (
      <div className="space-y-4">
        <div>
          <h4 className="font-semibold text-foreground mb-2">3.1 Pricing Plans</h4>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "3 Months", price: "₹299", note: "Base" },
              { label: "6 Months", price: "₹549", note: "Save ₹49" },
              { label: "1 Year", price: "₹849", note: "Save ₹347 — Best Value" },
            ].map((p) => (
              <div key={p.label} className="border border-border rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">{p.label}</p>
                <p className="text-lg font-bold text-foreground">{p.price}</p>
                <p className="text-xs text-muted-foreground">{p.note}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div>
            <span className="font-semibold text-foreground">3.2 Payment — </span>
            Payments are processed via Razorpay (UPI, Cards, Net Banking). All transactions are encrypted and secure.
            We do not store your card details.
          </div>
          <div>
            <span className="font-semibold text-foreground">3.3 Activation — </span>
            Subscription activates immediately after successful payment confirmation.
          </div>
          <div>
            <span className="font-semibold text-foreground">3.4 Cancellation — </span>
            Cancel anytime from Profile → Subscription. Access continues until your current period ends. No refunds for
            unused days of an active subscription period.
          </div>
          <div>
            <span className="font-semibold text-foreground">3.5 Expiry — </span>
            Subscriptions expire automatically. You will be notified 3 days before expiry. After expiry, premium
            features are locked until renewal.
          </div>
          <div>
            <span className="font-semibold text-foreground">3.6 Failed Payments — </span>
            If payment fails, the subscription will not activate. Contact support with your transaction reference.
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "privacy",
    icon: Lock,
    title: "Data & Privacy",
    content: (
      <div className="space-y-4 text-sm text-muted-foreground">
        <div>
          <h4 className="font-semibold text-foreground mb-2">4.1 What We Collect</h4>
          <ul className="space-y-1 list-disc list-inside">
            <li>Account info: name, email, profile picture (via Google OAuth)</li>
            <li>Health data: weight, height, calorie goals, dietary preferences</li>
            <li>Usage data: food logs, water intake, fasting sessions</li>
            <li>Payment data: transaction ID, amount, status — we do NOT store card details</li>
            <li>Technical data: IP address, login timestamps</li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-2">4.2 How We Use It</h4>
          <ul className="space-y-1 list-disc list-inside">
            <li>To power AI food analysis and diet recommendations</li>
            <li>To display your personalized dashboard and analytics</li>
            <li>To manage your subscription and payment status</li>
            <li>To improve app features and fix bugs</li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-2">4.3 Data Storage & Security</h4>
          <ul className="space-y-1 list-disc list-inside">
            <li>Stored in a secured MySQL database with encrypted credentials</li>
            <li>Passwords are hashed using bcrypt — we cannot view your password</li>
            <li>JWT tokens expire after 30 days</li>
            <li>SQL injection prevention via prepared statements and Pydantic validation</li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-2">4.4 Third-Party Services</h4>
          <ul className="space-y-1 list-disc list-inside">
            <li>Google OAuth — authentication</li>
            <li>OpenRouter AI API — AI-powered features</li>
            <li>Razorpay — payment processing</li>
          </ul>
          <p className="mt-2">Each third party has its own privacy policy.</p>
        </div>
        <div className="bg-primary dark:bg-primary/20 border border-primary dark:border-primary rounded-lg p-3">
          <p className="text-primary dark:text-primary font-medium flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0" />
            We do not sell your personal data to anyone, ever.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-1">4.5 Your Rights</h4>
          <p>Request data export or deletion by contacting support. Update your profile anytime in the app.</p>
        </div>
      </div>
    ),
  },
  {
    id: "ai",
    icon: Brain,
    title: "AI & Health Disclaimer",
    badge: "Read Carefully",
    content: (
      <div className="space-y-4">
        <div className="bg-[color:var(--warning)] dark:bg-[color:var(--warning)]/20 border border-[color:var(--warning)] dark:border-[color:var(--warning)] rounded-lg p-4">
          <div className="flex gap-2 items-start">
            <AlertTriangle className="w-5 h-5 text-[color:var(--warning)] dark:text-[color:var(--warning)] shrink-0 mt-0.5" />
            <p className="text-sm text-[color:var(--warning)] dark:text-[color:var(--warning)] font-medium">
              NutriLife's AI features are for informational purposes only and are NOT a substitute for
              professional medical advice.
            </p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground space-y-3">
          <p>
            <span className="font-semibold text-foreground">AI Food Analyzer</span> — Estimates nutrition from
            food images. Accuracy depends on image quality, lighting, and portion visibility. Results are
            approximate and should not be used for clinical dietary management.
          </p>
          <p>
            <span className="font-semibold text-foreground">AI Diet Planner</span> — Generates meal plans based
            on your stated goals. Individual health conditions, allergies, and medical needs may require different
            plans from a registered dietitian.
          </p>
          <p>
            <span className="font-semibold text-foreground">Health Assistant</span> — Provides general nutrition
            information. It does not diagnose conditions, prescribe medications, or replace a doctor's
            consultation.
          </p>
          <p className="font-medium text-foreground">
            Do NOT make significant changes to your diet or health routine based solely on NutriLife's
            AI-generated advice without consulting a qualified healthcare professional.
          </p>
          <p>
            NutriLife and its developer are not liable for any health outcomes resulting from following
            AI-generated advice within the app.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "prohibited",
    icon: Shield,
    title: "Prohibited Use & Liability",
    content: (
      <div className="space-y-4 text-sm text-muted-foreground">
        <div>
          <h4 className="font-semibold text-foreground mb-2">6.1 You agree NOT to:</h4>
          <ul className="space-y-1 list-disc list-inside">
            <li>Attempt to bypass subscription or premium access controls</li>
            <li>Reverse engineer, scrape, or copy the app's AI systems or codebase</li>
            <li>Create fake accounts or engage in payment fraud</li>
            <li>Upload harmful, misleading, or inappropriate content to the AI Analyzer</li>
            <li>Use the app for any unlawful purpose under Indian law</li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-2">6.2 Limitation of Liability</h4>
          <p>NutriLife is provided "as is." We are not liable for:</p>
          <ul className="space-y-1 list-disc list-inside mt-1">
            <li>Health outcomes from following AI-generated advice</li>
            <li>Data loss due to user error or device issues</li>
            <li>Service interruptions during scheduled maintenance</li>
            <li>Third-party payment gateway failures</li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-1">6.3 Modifications to Terms</h4>
          <p>
            We may update these Terms at any time. Changes will be announced on our official Telegram channel.
            Continued use of NutriLife after an update means you accept the revised Terms.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-1">6.4 Governing Law</h4>
          <p>These Terms are governed by the laws of India.</p>
        </div>
      </div>
    ),
  },
]

function AccordionSection({ section }: { section: Section }) {
  const [open, setOpen] = useState(false)
  const Icon = section.icon

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <CardHeader className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base">{section.title}</CardTitle>
                {section.badge && (
                  <Badge variant="destructive" className="text-[10px] py-0">{section.badge}</Badge>
                )}
              </div>
            </div>
            {open ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
          </div>
        </CardHeader>
      </button>
      {open && (
        <CardContent className="pt-0 pb-5 border-t border-border">
          <div className="pt-4">{section.content}</div>
        </CardContent>
      )}
    </Card>
  )
}

export default function TermsPage() {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
      <div className="reveal-3d">
        <PageHeader
          title="Terms & Conditions"
          subtitle={`System Authorization Protocol · Last Sync: ${EFFECTIVE_DATE}`}
        />
      </div>

      {/* Intro card */}
      <div className="reveal-3d">
        <Card className="border-none glass-card bg-primary/5 rounded-[2rem]">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <FileText className="w-6 h-6 text-primary shrink-0" />
              <div className="text-xs font-bold text-muted-foreground leading-relaxed uppercase tracking-wider">
                By creating an account or using <span className="font-black text-foreground">NutriLife</span>,
                you agree to these Terms of Service. Please read each section carefully. If you have questions,
                contact us on our Telegram support channel.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sections */}
      <div className="space-y-4 mb-8">
        {sections.map((section) => (
          <div key={section.id} className="reveal-3d">
             <AccordionSection section={section} />
          </div>
        ))}
      </div>

      {/* Footer card */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-foreground mb-1">Questions about these Terms?</p>
              <p className="text-sm text-muted-foreground">
                Reach out to us on our official Telegram channel.
              </p>
            </div>
            <a href={TELEGRAM_LINK} target="_blank" rel="noopener noreferrer">
              <Button className="flex items-center gap-2 whitespace-nowrap">
                <Send className="w-4 h-4" />
                Telegram Support
                <ExternalLink className="w-3 h-3 opacity-70" />
              </Button>
            </a>
          </div>
          <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
            NutriLife · Developed by Safal Swayam · KIIT University · Last updated: {EFFECTIVE_DATE}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
