"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Utensils, Loader2, Clock, ChevronRight, RefreshCw, Sun, Apple, UtensilsCrossed, Coffee, Check, CheckCircle } from "lucide-react"
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
      breakfast:       Sun,
      morning_snack:   Apple,
      lunch:           UtensilsCrossed,
      afternoon_snack: Coffee,
      dinner:          Utensils,
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
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Utensils className="w-5 h-5 text-muted-foreground" />
            What to Eat Next
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-4 space-y-3">
          {hasPlan === false || hasPlan === null ? (
            <>
              <p className="text-sm text-muted-foreground">No active diet plan</p>
              <Link href="/diet-planner">
                <Button variant="outline" size="sm">
                  Create Diet Plan
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 justify-center">
                <CheckCircle className="w-4 h-4 text-green-500" />
                All meals logged for today
              </p>
              <Button variant="outline" size="sm" onClick={fetchNextMeal}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Refresh
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  /* ── Meal card ── */
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Utensils className="w-5 h-5 text-primary" />
            What to Eat Next
          </CardTitle>
          {nextMeal.is_tomorrow && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
              Tomorrow
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Meal header */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-card border">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">{getMealIcon(nextMeal.type)}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">
              {formatMealType(nextMeal.type)}
            </p>
            <p className="text-sm font-medium text-primary truncate">
              {nextMeal.dish || "Healthy Meal"}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Clock className="w-3 h-3 flex-shrink-0" />
              {nextMeal.is_tomorrow ? `Tomorrow · ${nextMeal.time}` : nextMeal.time}
            </div>
          </div>
        </div>

        {/* Ingredients */}
        {nextMeal.foods && nextMeal.foods.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
              Includes
            </p>
            <ul className="space-y-1">
              {nextMeal.foods.map((food, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  {food}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Nutrition grid */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t">
          {[
            { label: "Cal",    value: `${nextMeal.calories}`, color: "text-orange-600" },
            { label: "Protein", value: `${nextMeal.protein}g`, color: "text-blue-600" },
            { label: "Carbs",   value: `${nextMeal.carbs}g`,  color: "text-yellow-600" },
            { label: "Fat",     value: `${nextMeal.fat}g`,    color: "text-green-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className={`text-sm font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}