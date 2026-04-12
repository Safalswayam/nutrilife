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
import { NotificationCenter } from "@/components/notification-center"
import { Flame, Target, TrendingUp, Droplets, Activity, Utensils, Loader2, Sun, Sunrise, Sunset, Moon, X, Sparkles, Camera, Calculator, MessageCircle, Trophy, Zap, ArrowRight, Star } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, LineChart, Line
} from "recharts"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface DashboardStats {
  today_calories: number
  target_calories: number
  calorie_trend: number
  daily_goal_percentage: number
  water_glasses: number
  target_water: number
  weight_change: number | null
  avg_weekly_calories: number
  weekly_activity: Array<{
    date: string
    day: string
    calories: number
    is_today: boolean
  }>
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
  weekly_plan?: any
  weight_history?: Array<{
    date: string
    weight: number
  }>
}

function getGreeting(hour: number) {
  if (hour >= 5  && hour < 12) return { text: "Good morning",  icon: Sunrise, color: "text-amber-500" }
  if (hour >= 12 && hour < 17) return { text: "Good afternoon", icon: Sun, color: "text-orange-500" }
  if (hour >= 17 && hour < 21) return { text: "Good evening",  icon: Sunset, color: "text-indigo-500" }
  return                               { text: "Good night",   icon: Moon, color: "text-purple-500" }
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

function getProfileCompletion(user: any): { percent: number; missing: string[] } {
  const fields = [
    { key: "name", label: "Full Name" },
    { key: "gender", label: "Gender" },
    { key: "age", label: "Age" },
    { key: "height", label: "Height" },
    { key: "weight", label: "Weight" },
    { key: "activity_level", label: "Activity Level" },
    { key: "goal", label: "Health Goal" },
  ]
  const missing: string[] = []
  let filled = 0
  for (const f of fields) {
    if (user?.[f.key]) filled++
    else missing.push(f.label)
  }
  return { percent: Math.round((filled / fields.length) * 100), missing }
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
  const [showGettingStarted, setShowGettingStarted] = useState(true)

  useEffect(() => {
    const dismissed = localStorage.getItem("nutrilife_dismiss_getting_started")
    if (dismissed === "true") setShowGettingStarted(false)
  }, [])

  const dismissGettingStarted = () => {
    setShowGettingStarted(false)
    localStorage.setItem("nutrilife_dismiss_getting_started", "true")
  }

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const greeting   = useMemo(() => getGreeting(now.getHours()), [now])
  const dateStr    = useMemo(() => formatDate(now), [now])
  const timeStr    = useMemo(() => formatTime(now), [now])
  const mealNow    = useMemo(() => getMealTypeByTime(now.getHours()), [now])
  const profileCompletion = useMemo(() => getProfileCompletion(user), [user])

  const fetchDashboardStats = useCallback(async () => {
    if (!token) return
    
    try {
      setLoading(true)
      setError(null)
      const [resStats, resWeight] = await Promise.all([
        fetch(getApiUrl("/api/dashboard/stats"), { headers: { "Authorization": `Bearer ${token}` } }),
        fetch(getApiUrl("/api/weight/history"), { headers: { "Authorization": `Bearer ${token}` } })
      ])

      if (!resStats.ok) throw new Error("Failed to fetch dashboard stats")

      const dataStats = await resStats.json()
      const dataWeight = await resWeight.json()

      if (dataStats.success) {
        const fullStats = {
          ...dataStats.stats,
          weight_history: dataWeight.history || []
        }
        setStats(fullStats)
        setWaterData({
          current: Number(fullStats.water_glasses ?? 0),
          goal: Number(fullStats.target_water ?? 8)
        })

        if (fullStats.daily_goal_percentage >= 100 && fullStats.target_calories > 0) {
          import('canvas-confetti').then((confetti) => {
            confetti.default({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899']
            })
          })
        }
      }
    } catch (err) {
      console.error("Dashboard stats error:", err)
      setError("Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (!user || !token) {
      router.push("/login")
      return
    }
    
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
      <div className="p-4 md:p-8 space-y-8">
        <div className="reveal-3d">
          <PageHeader
            title="Welcome back!"
            subtitle="Track your health journey and stay on top of your nutrition goals"
          />
        </div>
        <div className="text-center text-muted-foreground glass-card p-12 rounded-3xl reveal-3d">
          {error || "Unable to load dashboard data"}
        </div>
      </div>
    )
  }

  const isNewUser = stats ? (stats.today_calories === 0 && stats.recent_meals.length === 0 && stats.water_glasses === 0) : false

  return (
    <div className="p-3 md:p-8 pb-32 md:pb-12 space-y-8 max-w-7xl mx-auto">
      {/* Time-aware header */}
      <div className="reveal-3d">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <div className={cn("p-4 rounded-3xl bg-card border shadow-xl shadow-primary/5", greeting.color)}>
                <greeting.icon className="w-10 h-10" />
              </div>
              <h1 className="text-4xl md:text-7xl font-black tracking-tight text-foreground uppercase leading-tight">
                {greeting.text}<br/><span className="text-primary">{user?.name ? user.name.split(" ")[0] : "Agent"}</span>
              </h1>
            </div>
            <p className="text-muted-foreground text-sm font-black uppercase tracking-[0.2em] ml-1 opacity-60">
              {mealNow === "breakfast" && "MORNING VITALS REQUIRED 🥑"}
              {mealNow === "lunch"     && "MID-DAY METABOLIC SYNC 🍱"}
              {mealNow === "dinner"    && "FINAL NUTRIENT LOAD 🥗"}
              {mealNow === "snack"     && "SYSTEMIC METABOLIC PULSE 🍏"}
            </p>
          </div>
          <div className="text-right bg-card p-8 rounded-[2.5rem] border shadow-xl shadow-primary/5 min-w-[240px]">
            <p className="text-4xl font-black text-primary leading-none mb-2 tracking-tighter">{timeStr}</p>
            <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40">{dateStr}</p>
          </div>
        </div>
      </div>

      {/* ── Profile Completion Banner ── */}
      {profileCompletion.percent < 100 && (
        <div className="reveal-3d">
          <Card className="border shadow-xl shadow-amber-500/5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent overflow-hidden rounded-[2.5rem]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-[100px] -z-10"></div>
            <CardContent className="py-8 px-8">
              <div className="flex flex-col md:flex-row md:items-center gap-8">
                <div className="w-20 h-20 rounded-3xl bg-amber-500/20 flex items-center justify-center shrink-0 shadow-3xl shadow-amber-500/20">
                  <Star className="w-10 h-10 text-amber-500 animate-pulse" />
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-black uppercase text-foreground tracking-tight">Identity Optimization</p>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-amber-500 text-white px-4 py-1.5 rounded-full shadow-lg shadow-amber-500/20">
                      {profileCompletion.percent}% Synced
                    </span>
                  </div>
                  <Progress value={profileCompletion.percent} className="h-2 rounded-full bg-amber-500/10" />
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest leading-loose">
                    Required fields for architectural precision: <span className="text-amber-500">{profileCompletion.missing.slice(0, 3).join(" · ")}</span>
                  </p>
                </div>
                <Link href="/profile" className="shrink-0">
                  <Button size="lg" className="h-14 px-8 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl shadow-3xl shadow-amber-500/30">
                    Sync Profile <ArrowRight className="ml-3 w-5 h-5" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Getting Started Card for New Users ── */}
      {isNewUser && showGettingStarted && (
        <div className="reveal-3d">
          <Card className="border-none glass-card bg-gradient-to-br from-primary/10 via-transparent to-transparent overflow-hidden">
            <button
              onClick={dismissGettingStarted}
              className="absolute top-4 right-4 p-2 rounded-xl hover:bg-white/10 text-muted-foreground transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-2xl font-black">
                <Sparkles className="w-6 h-6 text-primary" />
                Your Success Roadmap
              </CardTitle>
              <p className="text-muted-foreground font-medium">Follow these quick steps to master your nutrition today.</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { href: "/food-log", icon: Utensils, label: "Log first meal", sub: "Track vitals", color: "orange" },
                  { href: "/food-analysis", icon: Camera, label: "Scan photo", sub: "AI Analysis", color: "blue" },
                  { href: "/diet-planner", icon: Calculator, label: "Get a plan", sub: "Goal oriented", color: "green" },
                  { href: "/health-assistant", icon: MessageCircle, label: "Ask the AI", sub: "Instant tips", color: "purple" }
                ].map((step, i) => (
                  <Link href={step.href} key={i} className="group">
                    <div className="flex items-center gap-4 p-4 rounded-2xl glass-card hover:bg-white/10 hover:-translate-y-1 transition-all duration-300">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner", 
                        step.color === "orange" && "bg-orange-500/20 text-orange-500",
                        step.color === "blue" && "bg-blue-500/20 text-blue-500",
                        step.color === "green" && "bg-green-500/20 text-green-500",
                        step.color === "purple" && "bg-purple-500/20 text-purple-500"
                      )}>
                        <step.icon className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-foreground truncate">{step.label}</p>
                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-tighter opacity-70">{step.sub}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Streak / Motivation Banner ── */}
      {stats && stats.daily_goal_percentage >= 100 && (
        <div className="reveal-3d">
          <div className="bg-card p-8 rounded-[2.5rem] bg-gradient-to-r from-yellow-500/10 to-transparent border shadow-xl shadow-yellow-500/5">
            <div className="flex items-center gap-8">
              <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center border border-yellow-500/20 shadow-2xl animate-bounce-slow">
                <Trophy className="w-10 h-10 text-yellow-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-3xl font-black text-foreground">CRUSHING IT! 🔥</h3>
                <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest opacity-60">Daily metabolic target synchronized. Consistency is your catalyst.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 reveal-3d">
        <StatCard
          title="Daily Fuel"
          value={stats.today_calories.toLocaleString()}
          subtitle={`Total: ${stats.target_calories.toLocaleString()} kcal`}
          icon={Flame}
          variant="orange"
          className="rounded-[2.5rem] shadow-xl shadow-orange-500/5 hover:-translate-y-2 transition-all duration-500"
          trend={stats.calorie_trend !== 0 ? { 
            value: Math.abs(stats.calorie_trend), 
            label: "vs prev", 
            positive: stats.calorie_trend < 0 
          } : undefined}
        />
        <StatCard
          title="Objective Sync"
          value={`${stats.daily_goal_percentage}%`}
          subtitle={stats.daily_goal_percentage < 50 ? "Sync Progressing" : "Surgical Precision"}
          icon={Target}
          variant="green"
          className="rounded-[2.5rem] shadow-xl shadow-primary/5 hover:-translate-y-2 transition-all duration-500"
        />
        <StatCard
          title="Fluid Intake"
          value={`${stats.water_glasses}/${stats.target_water}`}
          subtitle="Hydration Metrics"
          icon={Droplets}
          variant="green"
          className="rounded-[2.5rem] shadow-xl shadow-primary/5 hover:-translate-y-2 transition-all duration-500"
        />
        <StatCard
          title="Logged Vitals"
          value={stats.recent_meals.length}
          subtitle="System Entries"
          icon={Utensils}
          variant="green"
          className="rounded-[2.5rem] shadow-xl shadow-primary/5 hover:-translate-y-2 transition-all duration-500"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Activity Overview */}
          <div className="reveal-3d">
            <Card className="border shadow-2xl shadow-primary/5 rounded-[3rem] overflow-hidden">
              <CardHeader className="p-10 pb-0">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-4 text-3xl font-black uppercase tracking-tight">
                      <Activity className="w-8 h-8 text-orange-500" />
                      Momentum Matrix
                    </CardTitle>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40 ml-12">Temporal Calorie Velocity</p>
                  </div>
                  <div className="bg-primary/10 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-primary border border-primary/20">Operational</div>
                </div>
              </CardHeader>
              <CardContent className="p-10 pt-6">
                <div className="h-[320px] w-full mt-4">
                  {stats.weekly_activity.some(d => d.calories > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.weekly_activity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barGap={8}>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/60" vertical={false} />
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 10, fontWeight: 900, fill: "currentColor" }}
                          className="text-muted-foreground/80"
                          axisLine={false}
                          tickLine={false}
                          dy={15}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fontWeight: 900, fill: "currentColor" }}
                          className="text-muted-foreground/80"
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}
                        />
                        <Tooltip
                          cursor={{ fill: "currentColor", className: "text-orange-500/5", radius: 20 }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null
                            const d = payload[0].payload
                            return (
                              <div className="bg-card p-6 rounded-3xl shadow-4xl border border-border">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 flex items-center justify-between gap-4">
                                  {d.day} {d.is_today && <span className="bg-orange-500 text-white px-2 py-0.5 rounded-md">TODAY</span>}
                                </p>
                                <p className="text-3xl font-black text-orange-500 tracking-tighter">{d.calories.toLocaleString()} <span className="text-xs text-muted-foreground font-bold uppercase opacity-40">kcal</span></p>
                              </div>
                            )
                          }}
                        />
                        <Bar dataKey="calories" radius={[15, 15, 0, 0]} maxBarSize={45}>
                          {stats.weekly_activity.map((entry, i) => (
                            <Cell
                              key={i}
                              fill={entry.is_today ? "#f97316" : "#f97316"}
                              fillOpacity={entry.is_today ? 1 : 0.4}
                              className="transition-all duration-500"
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-6">
                      <div className="w-24 h-24 rounded-3xl bg-white/5 flex items-center justify-center border border-white/5">
                        <Activity className="w-10 h-10 opacity-20" />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="font-black text-xl uppercase tracking-widest opacity-60">Null Data</p>
                        <p className="text-xs font-bold opacity-30 uppercase tracking-widest">Awaiting systemic input</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-6 mt-12 pt-10 border-t border-white/5">
                  <div className="text-center space-y-1">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-40">Mean velocity</p>
                    <p className="text-3xl font-black text-foreground tracking-tighter">{stats.avg_weekly_calories.toLocaleString()}</p>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-40">Dominant Macro</p>
                    <p className="text-3xl font-black text-primary tracking-tighter">PROTEIN</p>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-40">Sync Streak</p>
                    <p className="text-3xl font-black text-foreground tracking-tighter">05 <span className="text-xs opacity-40 font-bold uppercase">Days</span></p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Weight & Meals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 reveal-3d">
            {/* Weight Chart */}
            {stats.weight_history && stats.weight_history.length > 0 && (
              <Card className="border shadow-xl shadow-primary/5 rounded-[2.5rem]">
                <CardHeader className="p-8 pb-2">
                  <CardTitle className="flex items-center gap-3 text-xl font-black">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Body Weight
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.weight_history}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                          dataKey="date"
                          hide
                        />
                        <YAxis
                          domain={['auto', 'auto']}
                          hide
                        />
                        <Tooltip
                          contentStyle={{ borderRadius: '24px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                          formatter={(value: number) => [`${value} kg`, "Weight"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="weight"
                          stroke="var(--primary)"
                          strokeWidth={4}
                          dot={{ fill: "var(--primary)", strokeWidth: 2, r: 6 }}
                          activeDot={{ r: 8, strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Meals Box */}
            <Card className="border shadow-xl shadow-primary/5 rounded-[2.5rem]">
               <CardHeader className="p-8 pb-4">
                  <CardTitle className="flex items-center gap-3 text-xl font-black">
                    <Utensils className="w-5 h-5 text-primary" />
                    Recent Vitals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.recent_meals.slice(0, 3).map((meal, i) => (
                      <div key={i} className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-black text-primary uppercase">
                          {meal.food_name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black truncate capitalize">{meal.food_name}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">{meal.meal_type}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-foreground">{meal.calories}</p>
                          <p className="text-[9px] font-bold text-muted-foreground">KCAL</p>
                        </div>
                      </div>
                    ))}
                    {stats.recent_meals.length === 0 && (
                       <div className="text-center py-6 opacity-40">
                         <p className="text-xs font-bold uppercase tracking-widest">No meals logged</p>
                       </div>
                    )}
                  </div>
                  <Link href="/food-log">
                    <Button variant="ghost" className="w-full mt-4 text-xs font-black uppercase tracking-widest hover:bg-white/5">View Full Log</Button>
                  </Link>
                </CardContent>
            </Card>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-10 reveal-3d">
          <NotificationCenter />
          
          <EnhancedWaterIntake
            current={waterData.current}
            goal={waterData.goal}
            className="border shadow-2xl shadow-primary/10 rounded-[3.5rem] overflow-hidden"
            onUpdate={(newValue: number) => setWaterData(prev => ({ ...prev, current: newValue }))}
          />
          
          <div className="bg-card rounded-[3.5rem] border shadow-xl shadow-primary/5 divide-y divide-border">
            <WhatToEatNext />
            <div className="p-10 space-y-12">
               <QuickActions />
               <MacroBreakdown 
                 protein={stats.macros.protein} 
                 carbs={stats.macros.carbs} 
                 fat={stats.macros.fat} 
               />
            </div>
            <HealthTips />
          </div>
        </div>
      </div>
    </div>
  )
}