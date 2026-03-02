"use client"

import React, { useState, useEffect, useCallback } from "react"
import { getApiUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Moon, Play, Square, Clock, CheckCircle, AlertTriangle,
  Loader2, Trophy, TrendingUp, Calendar, Zap, Sun,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface FastingPlan {
  id: string; name: string; emoji: string; fast_hours: number; eat_hours: number
  category: string; difficulty: string; description: string; suitable_for: string
  benefits: string[]; tips: string[]
}
interface ActiveSession {
  id: number; plan_type: string; plan: FastingPlan; start_time: string
  target_end_time: string | null; elapsed_seconds: number; remaining_seconds: number
  elapsed_hours: number; goal_hours: number; progress_percent: number; goal_reached: boolean
}
interface HistorySession {
  id: number; plan_type: string; plan_name: string; plan_emoji: string
  start_time: string; end_time: string | null; duration_hours: number; completed: boolean
}
interface FastingStats {
  total_sessions: number; completed_sessions: number
  avg_duration_hours: number; success_rate_percent: number
}

const difficultyColor: Record<string, string> = {
  None:        "bg-gray-100 text-gray-600",
  Easy:        "bg-green-100 text-green-700",
  Moderate:    "bg-yellow-100 text-yellow-700",
  Hard:        "bg-orange-100 text-orange-700",
  "Very Hard": "bg-red-100 text-red-700",
  Extreme:     "bg-purple-100 text-purple-700",
}

function pad(n: number) { return n.toString().padStart(2, "0") }
function splitSecs(s: number) {
  return { h: pad(Math.floor(s / 3600)), m: pad(Math.floor((s % 3600) / 60)), s: pad(s % 60) }
}

/* ── Animated ring timer — shown both idle (0%) and active ── */
function RingTimer({
  seconds,
  goalSeconds,
  emoji,
  isActive,
}: {
  seconds: number
  goalSeconds: number
  emoji: string
  isActive: boolean
}) {
  const { h, m, s } = splitSecs(seconds)
  const pct = goalSeconds > 0 ? Math.min(100, (seconds / goalSeconds) * 100) : 0
  const R = 80
  const C = 2 * Math.PI * R
  const offset = C * (1 - pct / 100)

  return (
    <div className="flex flex-col items-center py-2">
      <div className="relative w-52 h-52">
        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
          {/* Track ring */}
          <circle
            cx="100" cy="100" r={R}
            fill="none" strokeWidth="10"
            className="stroke-muted"
          />
          {/* Progress ring */}
          <circle
            cx="100" cy="100" r={R}
            fill="none" strokeWidth="10"
            stroke="url(#ringGrad)"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span className="text-2xl">{emoji}</span>

          {isActive ? (
            /* Live clock digits */
            <div className="flex items-end gap-0.5 font-mono">
              {[{ v: h, l: "h" }, { v: m, l: "m" }, { v: s, l: "s" }].map(({ v, l }, i) => (
                <React.Fragment key={l}>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground tabular-nums leading-none">{v}</div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-widest">{l}</div>
                  </div>
                  {i < 2 && <div className="text-xl font-bold text-muted-foreground leading-none mb-3">:</div>}
                </React.Fragment>
              ))}
            </div>
          ) : (
            /* Idle state */
            <div className="text-center">
              <div className="text-sm font-semibold text-muted-foreground">Ready</div>
              <div className="text-xs text-muted-foreground/60">to fast</div>
            </div>
          )}

          {/* Percentage */}
          <div className={cn("text-xs font-medium mt-1", isActive ? "text-indigo-600" : "text-muted-foreground/50")}>
            {Math.round(pct)}%
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FastingTrackerPage() {
  const { token } = useAuth()
  const [allPlans, setAllPlans]           = useState<FastingPlan[]>([])
  const [savedPlanId, setSavedPlanId]     = useState("none")
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [history, setHistory]             = useState<HistorySession[]>([])
  const [stats, setStats]                 = useState<FastingStats | null>(null)
  const [loading, setLoading]             = useState(true)
  const [starting, setStarting]           = useState(false)
  const [ending, setEnding]               = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [success, setSuccess]             = useState<string | null>(null)
  const [elapsed, setElapsed]             = useState(0)

  const fetchStatus = useCallback(async () => {
    if (!token) return
    try {
      const [sR, hR, pR] = await Promise.all([
        fetch(getApiUrl("/api/fasting/status"),          { headers: { Authorization: `Bearer ${token}` } }),
        fetch(getApiUrl("/api/fasting/history?days=30"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(getApiUrl("/api/fasting/my-plan"),         { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (sR.ok) {
        const d = await sR.json()
        setActiveSession(d.active ? d.session : null)
        if (d.active && d.session) setElapsed(d.session.elapsed_seconds)
      }
      if (hR.ok) { const d = await hR.json(); setHistory(d.sessions || []); setStats(d.stats || null) }
      if (pR.ok) { const d = await pR.json(); setSavedPlanId(d.plan_id || "none") }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [token])

  const fetchPlans = useCallback(async () => {
    try {
      const r = await fetch(getApiUrl("/api/fasting/plans"))
      if (r.ok) { const d = await r.json(); setAllPlans(d.plans || []) }
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchPlans(); fetchStatus() }, [fetchPlans, fetchStatus])

  useEffect(() => {
    if (!activeSession) return
    const t = setInterval(() => setElapsed(p => p + 1), 1000)
    return () => clearInterval(t)
  }, [activeSession])

  const startFasting = async () => {
    if (!token) return; setStarting(true); setError(null); setSuccess(null)
    try {
      const r = await fetch(getApiUrl("/api/fasting/start"), {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || "Failed to start session")
      setSuccess(d.message || "Fasting session started!")
      await fetchStatus()
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to start fasting") }
    finally { setStarting(false) }
  }

  const endFasting = async () => {
    if (!token) return; setEnding(true); setError(null); setSuccess(null)
    try {
      const r = await fetch(getApiUrl("/api/fasting/end"), {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || "Failed to end session")
      setSuccess(d.message || "Session ended!")
      setActiveSession(null); setElapsed(0); await fetchStatus()
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to end fasting") }
    finally { setEnding(false) }
  }

  const savePlan = async (planId: string) => {
    if (!token) return
    try {
      const r = await fetch(getApiUrl("/api/fasting/set-plan"), {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan_id: planId }),
      })
      if (r.ok) { setSavedPlanId(planId); setSuccess("Fasting plan saved!"); setTimeout(() => setSuccess(null), 3000) }
    } catch { /* silent */ }
  }

  const savedPlan   = allPlans.find(p => p.id === savedPlanId) || null
  const goalSeconds = activeSession ? activeSession.goal_hours * 3600 : 0
  const progress    = goalSeconds > 0 ? Math.min(100, (elapsed / goalSeconds) * 100) : 0
  const remaining   = goalSeconds > 0 ? Math.max(0, goalSeconds - elapsed) : 0
  const goalReached = progress >= 100
  const planEmoji   = activeSession?.plan?.emoji ?? savedPlan?.emoji ?? "🌙"

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

        {/* ══ LEFT: Timer card (always visible) + controls ══ */}
        <div className="lg:col-span-2 space-y-6">

          {/* Main timer card — always shown, switches state */}
          <Card className={cn(
            "transition-all",
            activeSession
              ? "border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30"
              : ""
          )}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className={cn(
                  "flex items-center gap-2",
                  activeSession ? "text-indigo-800 dark:text-indigo-200" : ""
                )}>
                  <Moon className="w-5 h-5" />
                  {activeSession ? "Fasting in Progress" : "Start Fasting"}
                </CardTitle>

                {activeSession && (
                  <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                    </span>
                    Live
                  </div>
                )}
              </div>

              <CardDescription className={activeSession ? "text-indigo-700 dark:text-indigo-400" : ""}>
                {activeSession
                  ? `${activeSession.plan.emoji} ${activeSession.plan.name}`
                  : savedPlan && savedPlan.id !== "none"
                    ? `Using: ${savedPlan.emoji} ${savedPlan.name}`
                    : "Select a plan from the right panel to begin"}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* ── Ring timer (always rendered, 0% when idle) ── */}
              <div className={cn(
                "rounded-xl py-2",
                activeSession
                  ? "bg-white/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900"
                  : "bg-muted/30 border"
              )}>
                <RingTimer
                  seconds={elapsed}
                  goalSeconds={goalSeconds}
                  emoji={planEmoji}
                  isActive={!!activeSession}
                />
              </div>

              {/* Progress info when active */}
              {activeSession && activeSession.goal_hours > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    Started: {new Date(activeSession.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {remaining > 0
                    ? <span>{splitSecs(remaining).h}:{splitSecs(remaining).m} remaining</span>
                    : <span className="text-green-600 font-medium">🎉 Goal reached!</span>
                  }
                </div>
              )}

              {/* Goal reached */}
              {goalReached && (
                <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30">
                  <Trophy className="w-4 h-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-700 dark:text-yellow-300 font-semibold">
                    🎉 Goal reached! You can break your fast now.
                  </AlertDescription>
                </Alert>
              )}

              {/* Start/end times when active */}
              {activeSession && (
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
              )}

              {/* Idle — plan preview */}
              {!activeSession && savedPlan && savedPlan.id !== "none" && (
                <div className="grid grid-cols-2 gap-2">
                  {savedPlan.fast_hours > 0 && (
                    <>
                      <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-lg p-2.5 text-center">
                        <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{savedPlan.fast_hours}h</p>
                        <p className="text-xs text-muted-foreground">Fasting window</p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-2.5 text-center">
                        <p className="text-lg font-bold text-green-700 dark:text-green-300">{savedPlan.eat_hours}h</p>
                        <p className="text-xs text-muted-foreground">Eating window</p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* CTA button */}
              {activeSession ? (
                <Button onClick={endFasting} disabled={ending} variant="destructive" className="w-full" size="lg">
                  {ending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ending...</>
                          : <><Square className="w-4 h-4 mr-2" />End Fasting Session</>}
                </Button>
              ) : (
                <Button
                  onClick={startFasting}
                  disabled={starting || !savedPlanId || savedPlanId === "none"}
                  className="w-full" size="lg"
                >
                  {starting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting...</>
                            : <><Play className="w-4 h-4 mr-2" />Start Fasting Session</>}
                </Button>
              )}

              {!activeSession && (!savedPlanId || savedPlanId === "none") && (
                <p className="text-xs text-center text-muted-foreground">
                  Select a fasting plan from the list on the right to start.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          {stats && stats.total_sessions > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total Sessions", value: stats.total_sessions,            Icon: Calendar,   color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-950/20" },
                { label: "Completed",      value: stats.completed_sessions,         Icon: Trophy,     color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/20" },
                { label: "Avg Duration",   value: `${stats.avg_duration_hours}h`,   Icon: Clock,      color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/20" },
                { label: "Success Rate",   value: `${stats.success_rate_percent}%`, Icon: TrendingUp, color: "text-green-600",  bg: "bg-green-50 dark:bg-green-950/20" },
              ].map(({ label, value, Icon, color, bg }) => (
                <Card key={label}>
                  <CardContent className={cn("p-4 text-center rounded-xl", bg)}>
                    <Icon className={cn("w-5 h-5 mx-auto mb-1", color)} />
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
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
                <div className="space-y-2">
                  {history.slice(0, 7).map(session => (
                    <div key={session.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{session.plan_emoji}</span>
                        <div>
                          <p className="font-medium text-sm">{session.plan_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {session.start_time
                              ? new Date(session.start_time).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                              : "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">{session.duration_hours}h</span>
                        {session.completed
                          ? <CheckCircle className="w-4 h-4 text-green-500" />
                          : <AlertTriangle className="w-4 h-4 text-orange-400" />}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ══ RIGHT: Plan selector ══ */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Moon className="w-4 h-4 text-indigo-500" />
                Choose Your Fasting Plan
              </CardTitle>
              <CardDescription>Tap a plan to select it as your default.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
              {allPlans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => savePlan(plan.id)}
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
                    <div className="flex items-center gap-1.5">
                      <Badge className={cn("text-xs font-medium border-0", difficultyColor[plan.difficulty] || difficultyColor["None"])}>
                        {plan.difficulty}
                      </Badge>
                      {savedPlanId === plan.id && <CheckCircle className="w-4 h-4 text-indigo-500" />}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2">{plan.description}</p>

                  {plan.fast_hours > 0 && (
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                        <Moon className="w-3 h-3" />{plan.fast_hours}h fast
                      </span>
                      <span className="text-muted-foreground text-xs">·</span>
                      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                        <Sun className="w-3 h-3" />{plan.eat_hours}h eat
                      </span>
                    </div>
                  )}

                  {savedPlanId === plan.id && plan.benefits.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {plan.benefits.slice(0, 3).map((b, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                          {b}
                        </span>
                      ))}
                    </div>
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