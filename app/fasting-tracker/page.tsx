"use client"

import React, { useState, useEffect, useCallback } from "react"
import { getApiUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  Moon,
  Play,
  Square,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Trophy,
  TrendingUp,
  Calendar,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface FastingPlan {
  id: string
  name: string
  emoji: string
  fast_hours: number
  eat_hours: number
  category: string
  difficulty: string
  description: string
  suitable_for: string
  benefits: string[]
  tips: string[]
}

interface ActiveSession {
  id: number
  plan_type: string
  plan: FastingPlan
  start_time: string
  target_end_time: string | null
  elapsed_seconds: number
  remaining_seconds: number
  elapsed_hours: number
  goal_hours: number
  progress_percent: number
  goal_reached: boolean
}

interface HistorySession {
  id: number
  plan_type: string
  plan_name: string
  plan_emoji: string
  start_time: string
  end_time: string | null
  duration_hours: number
  completed: boolean
}

interface FastingStats {
  total_sessions: number
  completed_sessions: number
  avg_duration_hours: number
  success_rate_percent: number
}

const difficultyColor: Record<string, string> = {
  None: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  Easy: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  Moderate: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  Hard: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  "Very Hard": "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  Extreme: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

export default function FastingTrackerPage() {
  const { token } = useAuth()
  const [allPlans, setAllPlans] = useState<FastingPlan[]>([])
  const [savedPlanId, setSavedPlanId] = useState<string>("none")
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [history, setHistory] = useState<HistorySession[]>([])
  const [stats, setStats] = useState<FastingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Live timer
  const [elapsed, setElapsed] = useState(0)

  const fetchStatus = useCallback(async () => {
    if (!token) return
    try {
      const [statusRes, historyRes, planRes] = await Promise.all([
        fetch(getApiUrl("/api/fasting/status"), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(getApiUrl("/api/fasting/history?days=30"), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(getApiUrl("/api/fasting/my-plan"), {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      if (statusRes.ok) {
        const statusData = await statusRes.json()
        setActiveSession(statusData.active ? statusData.session : null)
        if (statusData.active && statusData.session) {
          setElapsed(statusData.session.elapsed_seconds)
        }
      }

      if (historyRes.ok) {
        const histData = await historyRes.json()
        setHistory(histData.sessions || [])
        setStats(histData.stats || null)
      }

      if (planRes.ok) {
        const planData = await planRes.json()
        setSavedPlanId(planData.plan_id || "none")
      }
    } catch (err) {
      console.error("Failed to fetch fasting status:", err)
    } finally {
      setLoading(false)
    }
  }, [token])

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/fasting/plans"))
      if (res.ok) {
        const data = await res.json()
        setAllPlans(data.plans || [])
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchPlans()
    fetchStatus()
  }, [fetchPlans, fetchStatus])

  // Live tick
  useEffect(() => {
    if (!activeSession) return
    const interval = setInterval(() => {
      setElapsed(prev => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [activeSession])

  const startFasting = async () => {
    if (!token) return
    setStarting(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(getApiUrl("/api/fasting/start"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Failed to start session")
      setSuccess(data.message || "Fasting session started!")
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start fasting")
    } finally {
      setStarting(false)
    }
  }

  const endFasting = async () => {
    if (!token) return
    setEnding(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(getApiUrl("/api/fasting/end"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Failed to end session")
      setSuccess(data.message || "Session ended!")
      setActiveSession(null)
      setElapsed(0)
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end fasting")
    } finally {
      setEnding(false)
    }
  }

  const setSavedPlan = async (planId: string) => {
    if (!token) return
    try {
      const res = await fetch(getApiUrl("/api/fasting/set-plan"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan_id: planId }),
      })
      if (res.ok) {
        setSavedPlanId(planId)
        setSuccess(`Fasting plan saved!`)
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch {}
  }

  const savedPlan = allPlans.find(p => p.id === savedPlanId) || null

  // Calculate current progress
  const goalSeconds = activeSession ? activeSession.goal_hours * 3600 : 0
  const progress = goalSeconds > 0 ? Math.min(100, (elapsed / goalSeconds) * 100) : 0
  const remaining = goalSeconds > 0 ? Math.max(0, goalSeconds - elapsed) : 0

  if (loading) {
    return (
      <div className="p-3 md:p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-3 md:p-8">
      <PageHeader
        title="Fasting Tracker"
        subtitle="Track your intermittent fasting sessions and monitor progress"
      />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mb-4 bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-green-700 dark:text-green-300">{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Timer + controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Session Timer */}
          {activeSession ? (
            <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-indigo-800 dark:text-indigo-200">
                  <Moon className="w-5 h-5" />
                  Fasting in Progress
                  <span className="ml-auto text-lg font-mono text-indigo-700 dark:text-indigo-300">
                    {formatDuration(elapsed)}
                  </span>
                </CardTitle>
                <CardDescription className="text-indigo-700 dark:text-indigo-400">
                  {activeSession.plan.emoji} {activeSession.plan.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeSession.goal_hours > 0 && (
                  <>
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-indigo-700 dark:text-indigo-300">
                        {Math.round(progress)}% complete
                      </span>
                      <span className="text-muted-foreground">
                        {remaining > 0 ? `${formatDuration(remaining)} remaining` : "Goal reached! 🎉"}
                      </span>
                    </div>
                    <Progress value={progress} className="h-3" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Start</span>
                      <span>Goal: {activeSession.goal_hours}h</span>
                    </div>
                  </>
                )}

                {progress >= 100 && (
                  <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30">
                    <Trophy className="w-4 h-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-700 dark:text-yellow-300 font-semibold">
                      🎉 Goal reached! You can break your fast now.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-white/60 dark:bg-indigo-950/40">
                    <p className="text-muted-foreground text-xs">Started</p>
                    <p className="font-semibold">
                      {new Date(activeSession.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {activeSession.target_end_time && (
                    <div className="p-3 rounded-lg bg-white/60 dark:bg-indigo-950/40">
                      <p className="text-muted-foreground text-xs">Target End</p>
                      <p className="font-semibold">
                        {new Date(activeSession.target_end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  onClick={endFasting}
                  disabled={ending}
                  variant="destructive"
                  className="w-full"
                  size="lg"
                >
                  {ending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ending...</>
                  ) : (
                    <><Square className="w-4 h-4 mr-2" />End Fasting Session</>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Start Fasting
                </CardTitle>
                <CardDescription>
                  {savedPlan && savedPlan.id !== "none"
                    ? `Using your saved plan: ${savedPlan.emoji} ${savedPlan.name}`
                    : "No fasting plan saved. Select one from the panel on the right."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {savedPlan && savedPlan.id !== "none" && (
                  <div className="rounded-lg border p-4 space-y-2 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">
                        {savedPlan.emoji} {savedPlan.name}
                      </span>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        difficultyColor[savedPlan.difficulty] || ""
                      )}>
                        {savedPlan.difficulty}
                      </span>
                    </div>
                    {savedPlan.fast_hours > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Fast {savedPlan.fast_hours}h · Eat {savedPlan.eat_hours}h
                      </p>
                    )}
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      {savedPlan.tips.slice(0, 2).map((tip, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <Zap className="w-3 h-3 mt-0.5 flex-shrink-0 text-yellow-500" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button
                  onClick={startFasting}
                  disabled={starting || savedPlanId === "none" || !savedPlanId}
                  className="w-full"
                  size="lg"
                >
                  {starting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting...</>
                  ) : (
                    <><Play className="w-4 h-4 mr-2" />Start Fasting Session</>
                  )}
                </Button>
                {(savedPlanId === "none" || !savedPlanId) && (
                  <p className="text-xs text-center text-muted-foreground">
                    Select a fasting plan from the list on the right to start.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          {stats && stats.total_sessions > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total Sessions", value: stats.total_sessions, icon: Calendar, color: "text-blue-600" },
                { label: "Completed", value: stats.completed_sessions, icon: Trophy, color: "text-yellow-600" },
                { label: "Avg Duration", value: `${stats.avg_duration_hours}h`, icon: Clock, color: "text-indigo-600" },
                { label: "Success Rate", value: `${stats.success_rate_percent}%`, icon: TrendingUp, color: "text-green-600" },
              ].map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="p-4 text-center">
                    <stat.icon className={cn("w-5 h-5 mx-auto mb-1", stat.color)} />
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="w-5 h-5 text-primary" />
                  Recent Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {history.slice(0, 7).map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{session.plan_emoji}</span>
                        <div>
                          <p className="font-medium text-sm">{session.plan_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {session.start_time ? new Date(session.start_time).toLocaleDateString() : "—"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <span className="text-sm font-medium">{session.duration_hours}h</span>
                        {session.completed ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-orange-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT: Plan selector */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Moon className="w-4 h-4 text-indigo-500" />
                Choose Your Fasting Plan
              </CardTitle>
              <CardDescription>Tap a plan to select it as your default.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
              {allPlans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSavedPlan(plan.id)}
                  className={cn(
                    "w-full text-left rounded-xl border p-3 transition-all",
                    savedPlanId === plan.id
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                      : "border-border hover:border-indigo-300 hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm flex items-center gap-1.5">
                      <span>{plan.emoji}</span>
                      <span>{plan.name}</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <span className={cn(
                        "text-xs px-1.5 py-0.5 rounded-full font-medium",
                        difficultyColor[plan.difficulty] || ""
                      )}>
                        {plan.difficulty}
                      </span>
                      {savedPlanId === plan.id && (
                        <CheckCircle className="w-4 h-4 text-indigo-500" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{plan.description}</p>
                  {plan.fast_hours > 0 && (
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 font-medium">
                      {plan.fast_hours}h fast / {plan.eat_hours}h eating window
                    </p>
                  )}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}