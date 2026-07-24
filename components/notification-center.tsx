"use client"

import { useEffect, useState, useCallback } from "react"
import { 
  Bell, 
  Droplets, 
  Utensils, 
  Moon, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  TrendingUp,
  Clock,
  Zap
} from "lucide-react"
import { getApiUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface ProtocolAlert {
  id: string
  type: "nutrition" | "hydration" | "fasting"
  title: string
  message: string
  status: "alert" | "info" | "success"
  time?: string
}

export function NotificationCenter() {
  const { token } = useAuth()
  const [alerts, setAlerts] = useState<ProtocolAlert[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProtocolStatus = useCallback(async () => {
    if (!token) return

    try {
      const [waterRes, mealRes, fastRes] = await Promise.all([
        fetch(getApiUrl("/api/water/today"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(getApiUrl("/api/diet-plan/next-meal"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(getApiUrl("/api/fasting/status"), { headers: { Authorization: `Bearer ${token}` } })
      ])

      const newAlerts: ProtocolAlert[] = []

      // 1. Hydration
      if (waterRes.ok) {
        const waterData = await waterRes.json()
        if (waterData.goal_reached) {
          newAlerts.push({
            id: "water-goal",
            type: "hydration",
            title: "Hydration Optimized",
            message: "Target achieved. Electrolyte balance maintained.",
            status: "success"
          })
        } else if (waterData.percentage < 40) {
          newAlerts.push({
            id: "water-low",
            type: "hydration",
            title: "Hydration Alert",
            message: `Current intake at ${Math.round(waterData.percentage)}%. Increase intake by ${waterData.goal - waterData.current} glasses.`,
            status: "alert"
          })
        }
      }

      // 2. Next Meal
      if (mealRes.ok) {
        const mealData = await mealRes.json()
        if (mealData.success && mealData.next_meal) {
          newAlerts.push({
            id: "next-meal",
            type: "nutrition",
            title: "Scheduled Nutrition",
            message: `${mealData.next_meal.dish} scheduled for ${mealData.next_meal.time}.`,
            status: "info",
            time: mealData.next_meal.time
          })
        }
      }

      // 3. Fasting
      if (fastRes.ok) {
        const fastData = await fastRes.json()
        if (fastData.active && fastData.session) {
          if (fastData.session.goal_reached) {
             newAlerts.push({
              id: "fasting-complete",
              type: "fasting",
              title: "Threshold Reached",
              message: "Metabolic switch active. Fasting threshold surpassed.",
              status: "success"
            })
          } else if (fastData.session.progress_percent > 80) {
             newAlerts.push({
                id: "fasting-near",
                type: "fasting",
                title: "Protocol Advancing",
                message: `Current fast at ${Math.round(fastData.session.progress_percent)}%. Deep ketosis approaching.`,
                status: "info"
             })
          }
        }
      }

      setAlerts(newAlerts)
    } catch (err) {
      console.error("Failed to fetch protocol status:", err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchProtocolStatus()
    const interval = setInterval(fetchProtocolStatus, 60000 * 5) // check every 5 mins
    return () => clearInterval(interval)
  }, [fetchProtocolStatus])

  if (loading && alerts.length === 0) return null
  if (alerts.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/50 flex items-center gap-2">
          <Zap className="w-3 h-3 text-[color:var(--warning)]" />
          Protocol Feed
        </h3>
        <Badge variant="outline" className="text-[8px] font-black tracking-widest border-white/5 opacity-40">
          LIVE SYNC
        </Badge>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => (
          <div 
            key={alert.id}
            className={cn(
              "group p-4 rounded-3xl border transition-all hover:scale-[1.02] active:scale-[0.98]",
              "bg-white dark:bg-muted-foreground shadow-sm",
              alert.status === "alert" ? "border-[color:var(--warning)]/20" : 
              alert.status === "success" ? "border-primary/20" : "border-muted-foreground dark:border-white/5"
            )}
          >
            <div className="flex gap-4">
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:rotate-12",
                alert.type === "hydration" ? "bg-[color:var(--info)]/10 text-[color:var(--info)]" :
                alert.type === "nutrition" ? "bg-[color:var(--warning)]/10 text-[color:var(--warning)]" :
                "bg-[color:var(--info)]/10 text-[color:var(--info)]"
              )}>
                {alert.type === "hydration" && <Droplets className="w-5 h-5" />}
                {alert.type === "nutrition" && <Utensils className="w-5 h-5" />}
                {alert.type === "fasting" && <Moon className="w-5 h-5" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-black uppercase tracking-tight text-foreground truncate">
                    {alert.title}
                  </h4>
                  {alert.status === "alert" && (
                    <span className="w-2 h-2 rounded-full bg-[color:var(--warning)] animate-pulse shrink-0 mt-1.5" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1 line-clamp-2">
                  {alert.message}
                </p>
              </div>

              <div className="shrink-0 flex items-center">
                <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
