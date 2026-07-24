"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Utensils, Loader2, Clock, ChevronRight, RefreshCw, Sun, Apple, UtensilsCrossed, Coffee, Check, CheckCircle, Zap } from "lucide-react"
import { getApiUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import Link from "next/link"

interface NextMeal {
  type: string
  time: string
  dish: string
  foods: string[]
  calories: number
  protein: number
  carbs: number
  fat: number
  is_tomorrow?: boolean
  is_adaptive?: boolean
  reason?: string
}

interface WhatToEatNextProps {
  weeklyPlan?: any
  currentMealType?: string
  currentTime?: Date
}

export function WhatToEatNext({
  weeklyPlan,
  currentMealType,
  currentTime,
}: WhatToEatNextProps = {}) {
  const { token } = useAuth()
  const [nextMeal, setNextMeal] = useState<NextMeal | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasPlan, setHasPlan] = useState<boolean | null>(null) // null = unknown

  const fetchNextMeal = useCallback(async () => {
    if (!token) { setIsLoading(false); return }

    try {
      setIsLoading(true)
      const response = await fetch(getApiUrl("/api/diet-plan/next-meal"), {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()

      if (data.success && data.next_meal) {
        setNextMeal(data.next_meal)
        setHasPlan(true)
      } else {
        setNextMeal(null)
        // Distinguish "no plan at all" from "plan exists but no meal right now"
        const msg = (data.message || "").toLowerCase()
        setHasPlan(!msg.includes("no active") && !msg.includes("no plan") && !msg.includes("no diet"))
      }
    } catch (error) {
      console.error("Failed to fetch next meal:", error)
      setNextMeal(null)
      setHasPlan(null)
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => { fetchNextMeal() }, [fetchNextMeal])

  const formatMealType = (type: string) =>
    type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())

  const getMealIcon = (type: string) => {
    const icons: Record<string, React.ElementType> = {
      breakfast: Sun,
      morning_snack: Apple,
      lunch: UtensilsCrossed,
      afternoon_snack: Coffee,
      dinner: Utensils,
    }
    const Icon = icons[type] || Utensils
    return <Icon className="w-6 h-6 text-primary" />
  }

  /* ── Loading ── */
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  /* ── No meal found ── */
  if (!nextMeal) {
    return (
      <div className="p-10 space-y-6">
        <div className="flex items-center gap-3">
          <Utensils className="w-6 h-6 text-muted-foreground opacity-30" />
          <p className="text-xl font-black uppercase tracking-tight text-muted-foreground opacity-30">What to Eat Next</p>
        </div>
        <div className="text-center py-10 space-y-6">
          {hasPlan === false || hasPlan === null ? (
            <>
              <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">No active structural protocol</p>
              <Link href="/diet-planner">
                <Button size="lg" className="rounded-2xl px-8 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all text-xs font-black uppercase tracking-widest border-none">
                  Architect Protocol
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-3 justify-center">
                <CheckCircle className="w-5 h-5" />
                METABOLIC SYNC COMPLETE
              </p>
              <Button variant="ghost" className="text-xs font-black uppercase tracking-widest opacity-40 hover:opacity-100" onClick={fetchNextMeal}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh System
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  /* ── Meal card ── */
  return (
    <div className="p-10 space-y-8 bg-gradient-to-br from-primary/10 via-transparent to-transparent">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0 shadow-lg shadow-primary/10 border border-primary/20">
            {getMealIcon(nextMeal.type)}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-1 opacity-70">Sequential Nutrient Load</p>
            <p className="text-3xl font-black uppercase tracking-tight text-foreground leading-none">{formatMealType(nextMeal.type)}</p>
          </div>
        </div>
        {nextMeal.is_tomorrow && (
          <span className="text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full bg-muted border text-muted-foreground">
            Tomorrow
          </span>
        )}
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between p-6 rounded-3xl bg-card border shadow-inner relative overflow-hidden">
          {nextMeal.is_adaptive && (
            <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-primary-foreground text-[8px] font-black uppercase tracking-widest rounded-bl-xl shadow-lg flex items-center gap-1">
              <Zap className="w-2.5 h-2.5 fill-white" /> Dynamic Sync
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 opacity-40">System Recommendation</p>
            <p className="text-2xl font-black text-primary truncate leading-tight">
              {nextMeal.dish || "Healthy Meal"}
            </p>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-2 opacity-60">
              <Clock className="w-3.5 h-3.5" />
              {nextMeal.is_tomorrow ? `Tomorrow · ${nextMeal.time}` : nextMeal.time}
            </div>
            {nextMeal.is_adaptive && nextMeal.reason && (
              <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-[9px] font-bold text-primary tracking-wide leading-relaxed uppercase italic">
                  "{nextMeal.reason}"
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Ingredients */}
        {nextMeal.foods && nextMeal.foods.length > 0 && (
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-40">
              Required Components
            </p>
            <ul className="grid grid-cols-1 gap-3">
              {nextMeal.foods.map((food, i) => (
                <li key={i} className="flex items-center gap-4 text-xs font-black uppercase tracking-widest text-foreground/80">
                  <div className="w-2 h-2 rounded-full bg-primary/40 shrink-0" />
                  {food}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Nutrition grid */}
        <div className="grid grid-cols-4 gap-4 pt-8 border-t border-border">
          {[
            { label: "Kcal", value: `${nextMeal.calories}`, color: "text-[color:var(--warning)]" },
            { label: "Prot", value: `${nextMeal.protein}g`, color: "text-[color:var(--info)]" },
            { label: "Carb", value: `${nextMeal.carbs}g`, color: "text-[color:var(--warning)]" },
            { label: "Fat", value: `${nextMeal.fat}g`, color: "text-primary" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-40">{label}</p>
              <p className={`text-sm font-black tracking-tight ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}