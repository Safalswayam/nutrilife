"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { useAuth } from "@/lib/auth-context"
import { getApiUrl } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { HealthTips } from "@/components/health-tips"
import { QuickActions } from "@/components/quick-actions"
import { MacroBreakdown } from "@/components/nutrition-chart"
import { EnhancedWaterIntake } from "@/components/enhanced-water-intake"
import { WhatToEatNext } from "@/components/what-to-eat-next"
import { Flame, Target, TrendingUp, Droplets, Activity, Utensils, Loader2, Sun, Sunrise, Sunset, Moon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"

interface DashboardStats {
  today_calories: number
  target_calories: number
  calorie_trend: number
  daily_goal_percentage: number
  water_glasses: number
  target_water: number
  weight_change: number | null
  avg_weekly_calories: number
  weekly_activity: number[]
  macros: {
    protein: number
    carbs: number
    fat: number
  }
  recent_meals: Array<{
    food_name: string
    calories: number
    meal_type: string
    logged_at: string
  }>
}

// ── Time helpers ──────────────────────────────────────────────────────────
function getGreeting(hour: number) {
  if (hour >= 5  && hour < 12) return { text: "Good morning",  icon: Sunrise }
  if (hour >= 12 && hour < 17) return { text: "Good afternoon", icon: Sun    }
  if (hour >= 17 && hour < 21) return { text: "Good evening",  icon: Sunset  }
  return                               { text: "Good night",   icon: Moon    }
}

function getMealTypeByTime(hour: number): string {
  if (hour >= 5  && hour < 10) return "breakfast"
  if (hour >= 10 && hour < 12) return "snack"
  if (hour >= 12 && hour < 15) return "lunch"
  if (hour >= 15 && hour < 18) return "snack"
  if (hour >= 18 && hour < 22) return "dinner"
  return "snack"
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  })
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
}

export default function DashboardPage() {
  const { user, token } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasFetched = useRef(false)
  const [waterData, setWaterData] = useState({ current: 0, goal: 8 })
  const [now, setNow] = useState(new Date())

  // Tick every minute
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const greeting   = useMemo(() => getGreeting(now.getHours()), [now])
  const dateStr    = useMemo(() => formatDate(now), [now])
  const timeStr    = useMemo(() => formatTime(now), [now])
  const mealNow    = useMemo(() => getMealTypeByTime(now.getHours()), [now])


  // ✅ FIX: Memoize fetchDashboardStats to prevent infinite loops
  const fetchDashboardStats = useCallback(async () => {
    if (!token) return
    
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(getApiUrl("/api/dashboard/stats"), {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch dashboard stats")
      }

      const data = await response.json()
      if (data.success) {
    setStats(data.stats)
    setWaterData({
    current: Number(data.stats.water_glasses ?? 0),
    goal: Number(data.stats.target_water ?? 8)
  })
}
    } catch (err) {
      console.error("Dashboard stats error:", err)
      setError("Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }, [token])

  // ✅ FIX: Proper useEffect with correct dependencies and fetch guard
  useEffect(() => {
    if (!user || !token) {
      router.push("/login")
      return
    }
    
    // Prevent multiple fetches on mount
    if (!hasFetched.current) {
      hasFetched.current = true
      fetchDashboardStats()
    }
  }, [user, token, router, fetchDashboardStats])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="p-4 md:p-8">
        <PageHeader
          title="Welcome back!"
          subtitle="Track your health journey and stay on top of your nutrition goals"
        />
        <div className="text-center text-muted-foreground">
          {error || "Unable to load dashboard data"}
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 md:p-8 pb-24 md:pb-8">
      {/* Time-aware header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div className="flex items-center gap-2">
            <greeting.icon className="w-6 h-6 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {greeting.text}{user?.name ? ", " + user.name.split(" ")[0] : ""}!
            </h1>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-foreground">{timeStr}</p>
            <p className="text-xs text-muted-foreground">{dateStr}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1 ml-8">
          {mealNow === "breakfast" && "🍳 Breakfast time — start your day right!"}
          {mealNow === "lunch"     && "🍱 Lunchtime — refuel and keep going!"}
          {mealNow === "dinner"    && "🍽️ Dinner time — wind down with a healthy meal!"}
          {mealNow === "snack"     && "🍎 Snack time — something light to keep you going!"}
        </p>
      </div>

      {/* Hero Stats - Mobile: 2 cols, Desktop: 4 cols */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <StatCard
          title="Calories"
          value={stats.today_calories.toLocaleString()}
          subtitle={`of ${stats.target_calories.toLocaleString()}`}
          icon={Flame}
          variant="primary"
          trend={stats.calorie_trend !== 0 ? { 
            value: Math.abs(stats.calorie_trend), 
            label: "from yesterday", 
            positive: stats.calorie_trend < 0 
          } : undefined}
        />
        <StatCard
          title="Daily Goal"
          value={`${stats.daily_goal_percentage}%`}
          subtitle={stats.daily_goal_percentage < 50 ? "Keep going!" : stats.daily_goal_percentage < 90 ? "Almost there!" : "Great job!"}
          icon={Target}
          variant="accent"
        />
        <StatCard
          title="Water"
          value={`${stats.water_glasses}/${stats.target_water}`}
          subtitle="glasses"
          icon={Droplets}
        />
        <StatCard
          title="Meals"
          value={stats.recent_meals.length}
          subtitle="logged today"
          icon={Utensils}
        />
      </div>

      {/* Main Content - Mobile: Stack, Desktop: Grid */}
      <div className="space-y-6 md:grid md:grid-cols-3 md:gap-6 md:space-y-0">
        {/* Main Column - 2/3 width on desktop */}
        <div className="md:col-span-2 space-y-6">
          {/* Activity Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Weekly Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 h-32">
                {stats.weekly_activity.length > 0 ? (
                  stats.weekly_activity.slice(-7).map((calories, index) => {
                    const maxCalories = Math.max(...stats.weekly_activity.slice(-7), 1)
                    const height = (calories / maxCalories) * 100
                    return (
                      <div key={index} className="flex-1 flex flex-col items-center gap-2">
                        <div
                          className="w-full rounded-t-lg bg-primary transition-all duration-500 hover:bg-primary/80 cursor-pointer group relative"
                          style={{ height: `${Math.max(height, 5)}%` }}
                          title={`${calories} calories`}
                        >
                          <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-xs bg-primary text-primary-foreground px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {calories} cal
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {["M", "T", "W", "T", "F", "S", "S"][index % 7]}
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <div className="flex-1 text-center text-muted-foreground">
                    No activity data yet
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{stats.avg_weekly_calories.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Avg. Calories</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{stats.macros.protein}g</p>
                  <p className="text-sm text-muted-foreground">Protein Today</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{stats.macros.carbs}g</p>
                  <p className="text-sm text-muted-foreground">Carbs Today</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Meals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Utensils className="w-5 h-5 text-primary" />
                Recent Meals
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.recent_meals && stats.recent_meals.length > 0 ? (
                <div className="space-y-4">
                  {stats.recent_meals.map((meal, index) => {
                    const date = new Date(meal.logged_at)
                    const timeStr = date.toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit',
                      hour12: true 
                    })
                    
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                          <span className="text-lg font-bold text-primary">
                            {meal.food_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-foreground capitalize">{meal.food_name}</p>
                            <span className="text-sm text-muted-foreground">{timeStr}</span>
                          </div>
                          <p className="text-sm text-muted-foreground capitalize">{meal.meal_type}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-foreground">{meal.calories}</p>
                          <p className="text-xs text-muted-foreground">kcal</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Utensils className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No meals logged yet</p>
                  <p className="text-sm">Start tracking by analyzing food!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Column - 1/3 width on desktop */}
        <div className="space-y-6">
          {/* Water Intake Widget */}
          <EnhancedWaterIntake
            current={waterData.current}
            goal={waterData.goal}
            onUpdate={(newValue: number) => {
              setWaterData(prev => ({
                ...prev,
                current: newValue
              }))
            }}
          />
          
          {/* What to Eat Next */}
          <WhatToEatNext />
          
          <QuickActions />
          <MacroBreakdown 
            protein={stats.macros.protein} 
            carbs={stats.macros.carbs} 
            fat={stats.macros.fat} 
          />
          <HealthTips />
        </div>
      </div>
    </div>
  )
}