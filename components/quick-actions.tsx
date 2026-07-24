"use client"

import Link from "next/link"
import { Camera, MessageCircle, Calculator, Apple, Zap } from "lucide-react"

const actions = [
  {
    title: "Analyze Food",
    description: "Scan or upload food photo",
    icon: Camera,
    href: "/food-analysis",
  },
  {
    title: "Health Chat",
    description: "Talk to health assistant",
    icon: MessageCircle,
    href: "/health-assistant",
  },
  {
    title: "Diet Plan",
    description: "Get personalized plan",
    icon: Calculator,
    href: "/diet-planner",
  },
  {
    title: "Food Log",
    description: "Track your meals",
    icon: Apple,
    href: "/food-analysis",
  },
]

export function QuickActions() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Zap className="w-6 h-6 text-primary" />
        <p className="text-xl font-black uppercase tracking-tight">Rapid Access</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {actions.map((action) => (
          <Link
            key={action.title}
            href={action.href}
            className="group relative flex flex-col items-center gap-4 p-6 rounded-3xl bg-muted/40 border border-white/5 hover:bg-primary transition-all duration-500 overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform duration-500">
              <action.icon className="w-12 h-12" />
            </div>
            {/* The card turns lime on hover, so the tile inverts to ink rather
                than white — a lime icon on a white tile measured ~1.4:1. */}
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg transition-all duration-500 bg-primary/15 text-primary group-hover:bg-nl-ink group-hover:text-primary">
              <action.icon className="w-7 h-7" />
            </div>
            <div className="text-center group-hover:scale-95 transition-transform">
              <p className="font-black text-[10px] uppercase tracking-widest text-foreground group-hover:text-primary-foreground mb-1">
                {action.title}
              </p>
              <p className="text-[9px] font-bold uppercase text-muted-foreground group-hover:text-primary-foreground/70 tracking-tighter">
                {action.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
