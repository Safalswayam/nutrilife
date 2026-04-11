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
  const R = 85
  const C = 2 * Math.PI * R
  const offset = C * (1 - pct / 100)

  return (
    <div className="flex flex-col items-center py-6">
      <div className="relative w-64 h-64">
        {/* Outer Glow */}
        <div className={cn(
          "absolute inset-0 rounded-full transition-all duration-1000",
          isActive ? "shadow-[0_0_50px_-10px_rgba(99,102,241,0.3)]" : ""
        )} />

        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
            <filter id="glow">
               <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
               <feMerge>
                   <feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/>
               </feMerge>
            </filter>
          </defs>
          {/* Track ring */}
          <circle
            cx="100" cy="100" r={R}
            fill="none" strokeWidth="8"
            className="stroke-white/5"
          />
          {/* Progress ring */}
          <circle
            cx="100" cy="100" r={R}
            fill="none" strokeWidth="8"
            stroke="url(#ringGrad)"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            filter={isActive ? "url(#glow)" : ""}
            style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          {isActive ? (
            <div className="animate-pulse">
               <Moon className="w-8 h-8 text-indigo-400" />
            </div>
          ) : (
             <Zap className="w-8 h-8 text-muted-foreground/30" />
          )}

          {isActive ? (
            /* Live clock digits */
            <div className="flex items-baseline gap-1">
              {[{ v: h, l: "h" }, { v: m, l: "m" }, { v: s, l: "s" }].map(({ v, l }, i) => (
                <div key={l} className="flex items-baseline">
                   <span className="text-4xl font-black tabular-nums tracking-tight">{v}</span>
                   <span className="text-[10px] font-black uppercase text-muted-foreground ml-0.5">{l}</span>
                   {i < 2 && <span className="text-xl font-black text-white/10 mx-0.5">:</span>}
                </div>
              ))}
            </div>
          ) : (
            /* Idle state */
            <div className="text-center">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">System Idle</div>
              <div className="text-sm font-black uppercase tracking-tighter">Ready to Fast</div>
            </div>
          )}

          {/* Percentage */}
          <div className={cn(
            "text-[10px] font-black uppercase tracking-widest py-1 px-3 rounded-full border transition-all duration-500",
            isActive
              ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
              : "bg-white/5 text-muted-foreground/40 border-white/5"
          )}>
            {Math.round(pct)}% Complete
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
  const planEmoji   = activeSession?.plan?.emoji ?? savedPlan?.emoji ?? ""

  if (loading) {
    return (
      <div className="p-3 md:p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-3 md:p-8">
      <div className="reveal-3d">
        <PageHeader
          title="Metabolic Phase Tracker"
          subtitle="Synchronizing systemic homeostasis through intermittent fasting protocols."
        />
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6 border-none glass-card bg-red-500/10 text-red-500 rounded-2xl reveal-3d">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription className="font-bold">{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mb-6 border-none glass-card bg-green-500/10 text-green-500 rounded-2xl reveal-3d">
           <CheckCircle className="w-4 h-4" />
           <AlertDescription className="font-bold">{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ══ LEFT: Timer card (always visible) + controls ══ */}
        <div className="lg:col-span-2 space-y-6">

          {/* Main timer card — always shown, switches state */}
          <Card className={cn(
            "border-none glass-card rounded-[2.5rem] overflow-hidden transition-all duration-500 reveal-3d",
            activeSession && "bg-white/5 ring-1 ring-indigo-500/20 shadow-3xl shadow-indigo-500/10"
          )}>
            <CardHeader className="p-8 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className={cn(
                  "text-2xl font-black uppercase tracking-tighter flex items-center gap-3",
                  activeSession ? "text-indigo-400" : ""
                )}>
                  <Moon className="w-6 h-6" />
                  {activeSession ? "Phase Protocol: Active" : "Phase Initiation"}
                </CardTitle>

                {activeSession && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black uppercase tracking-widest text-indigo-400">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                    </span>
                    Live Sync
                  </div>
                )}
              </div>

              <CardDescription className={cn("text-xs font-bold uppercase tracking-widest opacity-40", activeSession ? "text-indigo-300" : "")}>
                {activeSession
                  ? `Protocol ${activeSession.plan.emoji} ${activeSession.plan.name}`
                  : savedPlan && savedPlan.id !== "none"
                    ? `Queued Protocol: ${savedPlan.emoji} ${savedPlan.name}`
                    : "Initialize protocol in the structural panel"}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-8 pt-0 space-y-8">
              {/* ── Ring timer ── */}
              <div className="relative">
                <RingTimer
                  seconds={elapsed}
                  goalSeconds={goalSeconds}
                  emoji={planEmoji}
                  isActive={!!activeSession}
                />
              </div>

              {/* Progress info when active */}
              {activeSession && activeSession.goal_hours > 0 && (
                <div className="flex justify-between items-center px-6 py-4 rounded-2xl bg-white/5 border border-white/5 reveal-3d">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Began</span>
                    <span className="text-sm font-bold">{new Date(activeSession.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="h-8 w-px bg-white/10" />
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Status</span>
                    {remaining > 0
                      ? <span className="text-sm font-bold text-indigo-400">{splitSecs(remaining).h}h {splitSecs(remaining).m}m Left</span>
                      : <span className="text-sm font-black text-green-500 uppercase">Threshold Met</span>
                    }
                  </div>
                </div>
              )}

              {/* Goal reached */}
              {goalReached && (
                <Alert className="border-none glass-card bg-green-500/10 text-green-500 rounded-2xl animate-bounce">
                  <Trophy className="w-4 h-4" />
                  <AlertDescription className="font-black uppercase text-xs tracking-widest">
                    Metabolic Goal Achieved. Break fast authorized.
                  </AlertDescription>
                </Alert>
              )}

              {/* Idle — plan preview */}
              {!activeSession && savedPlan && savedPlan.id !== "none" && (
                <div className="grid grid-cols-2 gap-4 reveal-3d">
                  {savedPlan.fast_hours > 0 && (
                    <>
                      <div className="glass-card bg-indigo-500/5 rounded-2xl p-6 border-white/5 text-center">
                        <p className="text-3xl font-black text-indigo-500">{savedPlan.fast_hours}h</p>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-1">Fasting Period</p>
                      </div>
                      <div className="glass-card bg-emerald-500/5 rounded-2xl p-6 border-white/5 text-center">
                        <p className="text-3xl font-black text-emerald-500">{savedPlan.eat_hours}h</p>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-1">Refeed Period</p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* CTA button */}
              <div className="reveal-3d">
                {activeSession ? (
                  <Button onClick={endFasting} disabled={ending} variant="destructive" className="w-full h-16 rounded-[1.5rem] text-lg font-black shadow-3xl shadow-red-500/20 transition-all active:scale-95" size="lg">
                    {ending ? <Loader2 className="w-6 h-6 animate-spin" />
                            : <><Square className="w-5 h-5 mr-3" /> Terminate Session</>}
                  </Button>
                ) : (
                  <Button
                    onClick={startFasting}
                    disabled={starting || !savedPlanId || savedPlanId === "none"}
                    className="w-full h-16 rounded-[1.5rem] text-lg font-black shadow-3xl shadow-primary/20 transition-all active:scale-95" size="lg"
                  >
                    {starting ? <Loader2 className="w-6 h-6 animate-spin" />
                              : <><Play className="w-5 h-5 mr-3" /> Initiate Protocol</>}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          {stats && stats.total_sessions > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 reveal-3d">
              {[
                { label: "Total Syncs",   value: stats.total_sessions,            Icon: Calendar,   color: "text-blue-400" },
                { label: "Goals Met",    value: stats.completed_sessions,         Icon: Trophy,     color: "text-amber-400" },
                { label: "Avg Duration", value: `${stats.avg_duration_hours}h`,   Icon: Clock,      color: "text-indigo-400" },
                { label: "Success Rate", value: `${stats.success_rate_percent}%`, Icon: TrendingUp, color: "text-emerald-400" },
              ].map(({ label, value, Icon, color }) => (
                <Card key={label} className="border-none glass-card rounded-3xl overflow-hidden hover:scale-[1.05] transition-transform">
                  <CardContent className="p-6 text-center">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                       <Icon className={cn("w-5 h-5", color)} />
                    </div>
                    <p className="text-2xl font-black text-foreground mb-1">{value}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <Card className="border-none glass-card rounded-[2.5rem] overflow-hidden reveal-3d">
              <CardHeader className="p-8 pb-4">
                <CardTitle className="text-xl font-black uppercase tracking-widest flex items-center gap-3 opacity-60">
                  <Calendar className="w-5 h-5 text-primary" />
                  Temporal Archives
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 pt-0">
                <div className="space-y-3">
                  {history.slice(0, 7).map((session, idx) => (
                    <div key={session.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all reveal-3d" style={{animationDelay: `${idx*50}ms`}}>
                      <div className="flex items-center gap-4">
                        <span className="text-2xl drop-shadow-lg">{session.plan_emoji}</span>
                        <div>
                          <p className="font-black text-sm uppercase tracking-tight">{session.plan_name}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-40">
                            {session.start_time
                              ? new Date(session.start_time).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                              : "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                           <p className="text-xs font-black">{session.duration_hours}h</p>
                           <p className="text-[8px] font-black uppercase opacity-40">Duration</p>
                        </div>
                        {session.completed
                          ? <div className="p-1 px-2 rounded-lg bg-green-500/10"><CheckCircle className="w-4 h-4 text-green-500" /></div>
                          : <div className="p-1 px-2 rounded-lg bg-amber-500/10"><AlertTriangle className="w-4 h-4 text-amber-500" /></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ══ RIGHT: Plan selector ══ */}
        <div className="space-y-6 reveal-3d">
          <Card className="border-none glass-card rounded-[2.5rem] overflow-hidden">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-xl font-black uppercase tracking-widest flex items-center gap-3 opacity-60">
                <Moon className="w-4 h-4 text-indigo-400" />
                Protocols
              </CardTitle>
              <CardDescription className="text-[10px] font-black uppercase tracking-widest opacity-40">Select a systemic synchronization strategy.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-3 max-h-[700px] overflow-y-auto pr-1">
              {allPlans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => savePlan(plan.id)}
                  className={cn(
                    "w-full text-left rounded-3xl border border-white/5 p-5 transition-all group reveal-3d",
                    savedPlanId === plan.id
                      ? "bg-indigo-500/10 border-indigo-500/30"
                      : "bg-white/5 hover:bg-white/10"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-black text-sm flex items-center gap-2">
                      <span className="text-xl group-hover:scale-125 transition-transform">{plan.emoji}</span>
                      <span className="uppercase tracking-tight">{plan.name}</span>
                    </span>
                    <Badge className={cn("text-[8px] font-black uppercase tracking-widest border-none px-2 py-0.5", 
                      plan.difficulty === "Easy" ? "bg-green-500/20 text-green-400" :
                      plan.difficulty === "Moderate" ? "bg-amber-500/20 text-amber-400" :
                      "bg-red-500/20 text-red-400"
                    )}>
                      {plan.difficulty}
                    </Badge>
                  </div>

                  <p className="text-[10px] font-medium text-muted-foreground line-clamp-2 leading-relaxed mb-4">{plan.description}</p>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-400">
                       <Moon className="w-3 h-3" /> {plan.fast_hours}h
                    </div>
                    <div className="w-1 h-1 rounded-full bg-white/10" />
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                       <Sun className="w-3 h-3" /> {plan.eat_hours}h
                    </div>
                  </div>

                  {savedPlanId === plan.id && (
                    <div className="flex flex-wrap gap-1 mt-4 pt-4 border-t border-white/5">
                      {plan.benefits.slice(0, 2).map((b, i) => (
                        <span key={i} className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-white/5 text-muted-foreground">
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