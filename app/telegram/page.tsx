"use client"

import React, { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Send,
  ExternalLink,
  Bell,
  Shield,
  Zap,
  MessageCircle,
  Copy,
  CheckCircle,
  ChevronRight,
  Radio,
  Rocket,
  Sparkles,
  Bug,
  Wrench,
  Lock,
  CreditCard,
  KeyRound,
  Bot,
  Droplets,
  FileText,
} from "lucide-react"
import { toast } from "sonner"

const CHANNELS = [
  {
    id: "main",
    icon: Send,
    name: "@NUTRILIFEDIET",
    link: "https://t.me/NUTRILIFEDIET",
    title: "Official Updates Channel",
    description: "App releases, feature announcements, maintenance notices, and security patches.",
    badge: "Main Channel",
    badgeColor: "bg-primary text-primary-foreground",
    posts: [
      { icon: Rocket, label: "Version releases" },
      { icon: Sparkles, label: "New features" },
      { icon: Bug, label: "Bug fix notices" },
      { icon: Wrench, label: "Maintenance windows" },
      { icon: Lock, label: "Security patches" },
    ],
  },
  {
    id: "support",
    icon: MessageCircle,
    name: "@NUTRILIFEDIET",
    link: "https://t.me/NUTRILIFEDIET",
    title: "Support Chat",
    description: "DM us for payment issues, account problems, AI feature bugs, or anything else.",
    badge: "Support",
    badgeColor: "bg-primary/15 text-primary dark:bg-primary/15 dark:text-primary",
    posts: [
      { icon: CreditCard, label: "Payment issues" },
      { icon: KeyRound, label: "Account help" },
      { icon: Bot, label: "AI feature bugs" },
      { icon: Droplets, label: "Tracking issues" },
      { icon: FileText, label: "General queries" },
    ],
  },
]

const LATEST_POSTS = [
  {
    version: "v1.0 — Launch",
    date: "April 7, 2026",
    type: "Major Release",
    typeColor: "bg-primary/15 text-primary dark:bg-primary/15 dark:text-primary",
    summary:
      "NutriLife is officially live! Includes AI Food Analyzer, Diet Planner, Health Assistant, Fasting Tracker, Water Tracker, Google OAuth, Razorpay subscriptions, and more.",
  },
  {
    version: "Terms & Conditions",
    date: "April 7, 2026",
    type: "Policy",
    typeColor: "bg-[color:var(--info)]/15 text-[color:var(--info)] dark:bg-[color:var(--info)]/15 dark:text-[color:var(--info)]",
    summary:
      "Our Terms of Service are now live and accessible from within the app. Covers user eligibility, subscription terms, AI disclaimer, data privacy, and prohibited use.",
  },
  {
    version: "Support System Live",
    date: "April 7, 2026",
    type: "Announcement",
    typeColor: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] dark:bg-[color:var(--warning)]/15 dark:text-[color:var(--warning)]",
    summary:
      "Our Telegram support channel is active. Use @NUTRILIFEDIET for any issues. Response time is within 24 hours, Monday to Saturday.",
  },
]

const HOW_TO_REPORT = `BUG / ISSUE REPORT

[Email] Registered Email: 
[Device] Device / Browser: 
[Type] Issue Type: [ Login | Payment | AI Feature | Water/Fasting | Other ]
[Description]
(What happened? What did you expect?)

[Steps] Steps to Reproduce:
1. 
2. 
3. 

[Screenshot] (attach below)
━━━━━━━━━━━━━━━━━━
Send to @NUTRILIFEDIET`

export default function TelegramPage() {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(HOW_TO_REPORT).then(() => {
      setCopied(true)
      toast.success("Copied to clipboard!")
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <PageHeader
        title="Telegram Community"
        subtitle="Stay connected, get support, and never miss an update"
      />

      {/* Hero Banner */}
      <Card className="mb-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 overflow-hidden">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
              <Send className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground mb-1">Join NutriLife on Telegram</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Our Telegram channels are the official source for app updates, Terms of Service changes, support,
                and announcements. Turn on notifications to stay informed.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <a href="https://t.me/NUTRILIFEDIET" target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5" />
                    Join Updates
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </Button>
                </a>
                <a href="https://t.me/NUTRILIFEDIET" target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5" />
                    Get Support
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Channel Cards */}
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Our Channels</h3>
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {CHANNELS.map((ch) => {
          const Icon = ch.icon
          return (
            <Card key={ch.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4 text-primary" />
                  <span className="font-mono text-sm font-semibold text-primary">{ch.name}</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ml-auto ${ch.badgeColor}`}>
                    {ch.badge}
                  </span>
                </div>
                <CardTitle className="text-sm">{ch.title}</CardTitle>
                <CardDescription className="text-xs">{ch.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-1.5 mb-4">
                  {ch.posts.map((p) => {
                    const PostIcon = p.icon
                    return (
                    <li key={p.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <PostIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>{p.label}</span>
                    </li>
                    )
                  })}
                </ul>
                <a href={ch.link} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="w-full flex items-center gap-2 text-xs">
                    Open in Telegram
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Latest Announcements */}
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Latest Announcements
      </h3>
      <div className="space-y-3 mb-8">
        {LATEST_POSTS.map((post, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <Radio className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{post.version}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${post.typeColor}`}>
                      {post.type}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">{post.date}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{post.summary}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* What We Post */}
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        What We Post & When
      </h3>
      <Card className="mb-8">
        <CardContent className="pt-5">
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                icon: Zap,
                title: "Feature Releases",
                desc: "Every time a new feature is added or a major update ships",
                color: "text-[color:var(--warning)]",
              },
              {
                icon: Shield,
                title: "Security Patches",
                desc: "Whenever a security fix is deployed that may require action from you",
                color: "text-destructive",
              },
              {
                icon: Bell,
                title: "Maintenance Windows",
                desc: "At least 24 hours before any scheduled downtime",
                color: "text-[color:var(--info)]",
              },
              {
                icon: MessageCircle,
                title: "Policy Updates",
                desc: "When Terms & Conditions or Privacy Policy are updated",
                color: "text-primary",
              },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="flex gap-3">
                  <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${item.color}`} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Report Template */}
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        How to Report an Issue
      </h3>
      <Card className="mb-6">
        <CardContent className="pt-5">
          <p className="text-sm text-muted-foreground mb-3">
            When reporting a bug or issue to <span className="font-mono text-foreground">@NUTRILIFEDIET</span>,
            copy and fill out this template:
          </p>
          <div className="bg-muted rounded-lg p-4 font-mono text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed mb-3">
            {HOW_TO_REPORT}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={handleCopy}
          >
            {copied ? (
              <><CheckCircle className="w-4 h-4 text-primary" />Copied!</>
            ) : (
              <><Copy className="w-4 h-4" />Copy Template</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Links</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {[
            { label: "Terms & Conditions", href: "/terms", icon: Shield },
            { label: "Support Center (FAQ)", href: "/support", icon: MessageCircle },
            { label: "Subscription Plans", href: "/subscription", icon: Zap },
          ].map((link) => {
            const Icon = link.icon
            return (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">{link.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </a>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
