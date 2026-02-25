"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, Utensils, Loader2, ChevronRight } from "lucide-react"
import { getApiUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import Link from "next/link"

interface NextMeal {
  type: string
  time: string
  foods: string[]
  calories: number
  protein: number
  carbs: number
  fat: number
}

export function WhatToEatNext() {
  const { token } = useAuth()
  const [nextMeal, setNextMeal] = useState<NextMeal | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // ✅ Only fetch once on mount - no dependencies to prevent infinite loops
    fetchNextMeal()
  }, []) // Empty dependency array

  const fetchNextMeal = async () => {
    if (!token) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const response = await fetch(getApiUrl("/api/diet-plan/next-meal"), {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      
      if (data.success && data.next_meal) {
        setNextMeal(data.next_meal)
      }
    } catch (error) {
      console.error("Failed to fetch next meal:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatMealType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  const getMealIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      breakfast: '🍳',
      morning_snack: '🍎',
      lunch: '🍱',
      afternoon_snack: '🥤',
      dinner: '🍽️',
      other: '🍴'
    }
    return icons[type] || '🍴'
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  if (!nextMeal) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Utensils className="w-5 h-5 text-muted-foreground" />
            What to Eat Next
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-muted flex items-center justify-center mb-3">
            <Utensils className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-1">
            No active diet plan
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Create a personalized diet plan
          </p>
          <Link href="/diet-planner">
            <Button variant="outline" size="sm" className="gap-2">
              Create Diet Plan
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Utensils className="w-5 h-5 text-primary" />
          What to Eat Next
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Meal Type & Time */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
          <div className="text-2xl">{getMealIcon(nextMeal.type)}</div>
          <div className="flex-1">
            <p className="font-semibold text-foreground capitalize">
              {formatMealType(nextMeal.type)}
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{nextMeal.time}</span>
            </div>
          </div>
        </div>

        {/* Food Items */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Suggested Foods
          </p>
          {nextMeal.foods.slice(0, 3).map((food, index) => (
            <div 
              key={index} 
              className="flex items-start gap-2 text-sm p-2 rounded-md"
            >
              <span className="text-primary mt-0.5">✓</span>
              <span className="text-foreground flex-1">{food}</span>
            </div>
          ))}
          {nextMeal.foods.length > 3 && (
            <p className="text-xs text-muted-foreground pl-6">
              +{nextMeal.foods.length - 3} more items
            </p>
          )}
        </div>

        {/* Nutrition Info */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
          <div className="text-center p-2 rounded-md bg-muted/30">
            <p className="text-xs text-muted-foreground mb-0.5">Calories</p>
            <p className="text-lg font-bold text-orange-600">{nextMeal.calories}</p>
            <p className="text-xs text-muted-foreground">kcal</p>
          </div>
          <div className="text-center p-2 rounded-md bg-muted/30">
            <p className="text-xs text-muted-foreground mb-0.5">Protein</p>
            <p className="text-lg font-bold text-blue-600">{nextMeal.protein}g</p>
          </div>
        </div>

        {/* Macros */}
        <div className="flex gap-2 justify-center pt-1">
          <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
            {nextMeal.carbs}g carbs
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-600 border border-yellow-500/20">
            {nextMeal.fat}g fat
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
