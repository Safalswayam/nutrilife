"use client"

import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: {
    value: number
    label: string
    positive: boolean
  }
  variant?: "default" | "primary" | "accent" | "orange" | "green"
  className?: string
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:shadow-lg",
        variant === "primary" && "bg-secondary text-secondary-foreground border border-border",
        variant === "green" && "bg-primary/20 text-primary border border-primary/20",
        variant === "orange" && "bg-secondary text-primary border border-border",
        variant === "accent" && "bg-secondary text-secondary-foreground border border-border",
        variant === "default" && "bg-card text-card-foreground border border-border",
        className
      )}
    >
      {/* Background decoration */}
      <div
        className={cn(
          "absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10",
          variant === "primary" && "bg-primary",
          variant === "green" && "bg-primary",
          variant === "orange" && "bg-primary",
          variant === "accent" && "bg-primary",
          variant === "default" && "bg-primary"
        )}
      />

      <div className="relative z-10">
        {/* Icon */}
        <div
          className={cn(
            "inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4",
            variant === "primary" && "bg-primary/15",
            variant === "green" && "bg-primary/20",
            variant === "orange" && "bg-primary/15",
            variant === "accent" && "bg-primary/15",
            variant === "default" && "bg-primary/10"
          )}
        >
          <Icon
            className={cn(
              // every variant now sits on a dark surface, so the icon is lime —
              // `text-primary-foreground` here was ink-on-pine, ~1.3:1
              "w-6 h-6 text-primary"
            )}
          />
        </div>

        {/* Content */}
        <p
          className={cn(
            "text-sm font-medium mb-1",
            (variant === "default" || variant === "orange" || variant === "green") && "text-muted-foreground"
          )}
        >
          {title}
        </p>
        <p className={cn(
          "text-3xl font-bold mb-1",
          variant === "orange" && "text-primary",
          variant === "green" && "text-primary"
        )}>{value}</p>
        
        {subtitle && (
          <p
            className={cn(
              "text-sm",
              (variant === "default" || variant === "orange" || variant === "green") ? "text-muted-foreground" : "opacity-80"
            )}
          >
            {subtitle}
          </p>
        )}

        {/* Trend */}
        {trend && (
          <div className="flex items-center gap-2 mt-3">
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                trend.positive
                  ? "bg-primary/15 text-primary"
                  : "bg-destructive/15 text-destructive"
              )}
            >
              {trend.positive ? "+" : ""}
              {trend.value}%
            </span>
            <span
              className={cn(
                "text-xs",
                variant === "default" ? "text-muted-foreground" : "opacity-70"
              )}
            >
              {trend.label}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
