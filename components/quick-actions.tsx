"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Camera, MessageCircle, Calculator, Apple } from "lucide-react"

const actions = [
  {
    title: "Analyze Food",
    description: "Scan or upload food photo",
    icon: Camera,
    href: "/food-analysis",
    color: "bg-primary",
  },
  {
    title: "Health Chat",
    description: "Talk to health assistant",
    icon: MessageCircle,
    href: "/health-assistant",
    color: "bg-accent",
  },
  {
    title: "Diet Plan",
    description: "Get personalized plan",
    icon: Calculator,
    href: "/diet-planner",
    color: "bg-chart-3",
  },
  {
    title: "Food Log",
    description: "Track your meals",
    icon: Apple,
    href: "/food-analysis",
    color: "bg-chart-4",
  },
]

export function QuickActions() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-muted transition-all duration-200 hover:shadow-md"
            >
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-xl ${action.color} text-white transition-transform group-hover:scale-110`}
              >
                <action.icon className="w-6 h-6" />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm text-foreground">{action.title}</p>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
