"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils";
import { Activity } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
} from "recharts"

/* ─── Generic NutritionChart ─── */
interface NutritionData { name: string; value: number; color: string }

const defaultData: NutritionData[] = [
  { name: "Protein", value: 25, color: "#3b82f6" },
  { name: "Carbs", value: 45, color: "#f59e0b" },
  { name: "Fat", value: 20, color: "#10b981" },
  { name: "Fiber", value: 10, color: "#8b5cf6" },
]

export function NutritionChart({ data = defaultData, title = "Daily Nutrition" }: { data?: NutritionData[]; title?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={3} dataKey="value">
                {data.map((entry, i) => <Cell key={i} fill={entry.color} strokeWidth={0} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [`${v}g`, ""]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend verticalAlign="bottom" height={36} formatter={(value) => <span style={{ color: "#4b5563", fontSize: 13 }}>{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── MacroBreakdown ─── */
const MACROS = [
  { key: "protein" as const, label: "Protein", icon: "P", color: "#3b82f6", barColor: "#3b82f6", textColor: "#2563eb", bgLight: "#eff6ff", calPerG: 4, description: "Builds & repairs muscle" },
  { key: "carbs" as const, label: "Carbs", icon: "C", color: "#f59e0b", barColor: "#f59e0b", textColor: "#d97706", bgLight: "#fffbeb", calPerG: 4, description: "Primary energy source" },
  { key: "fat" as const, label: "Fat", icon: "F", color: "#10b981", barColor: "#10b981", textColor: "#059669", bgLight: "#ecfdf5", calPerG: 9, description: "Hormones & cell health" },
]

interface MacroBreakdownProps {
  protein?: number; carbs?: number; fat?: number
  targetProtein?: number; targetCarbs?: number; targetFat?: number
  targetCalories?: number
}

export function MacroBreakdown({
  protein = 0, carbs = 0, fat = 0,
  targetProtein = 0, targetCarbs = 0, targetFat = 0,
  targetCalories = 2000,
}: MacroBreakdownProps) {
  const tProtein = targetProtein || Math.round(targetCalories * 0.30 / 4)
  const tCarbs = targetCarbs || Math.round(targetCalories * 0.45 / 4)
  const tFat = targetFat || Math.round(targetCalories * 0.25 / 9)
  const values = { protein, carbs, fat }
  const targets = { protein: tProtein, carbs: tCarbs, fat: tFat }

  const proteinCal = Math.round(protein * 4)
  const carbsCal = Math.round(carbs * 4)
  const fatCal = Math.round(fat * 9)
  const totalCal = proteinCal + carbsCal + fatCal
  const hasData = totalCal > 0

  const donutData = hasData
    ? [
      { name: "Protein", value: proteinCal, color: "#3b82f6" },
      { name: "Carbs", value: carbsCal, color: "#f59e0b" },
      { name: "Fat", value: fatCal, color: "#10b981" },
    ]
    : [{ name: "No data", value: 1, color: "#e5e7eb" }]


  /* ── Sidebar Layout ── */
  return (
    <div className="space-y-10">
      <div className="flex items-center gap-3">
        <Activity className="w-6 h-6 text-primary" />
        <p className="text-xl font-black uppercase tracking-tight text-foreground/80">Macro Synthesis</p>
      </div>

      <div className="space-y-10">
        {/* Donut chart */}
        <div className="relative h-56 flex items-center justify-center translate-x-2">
          <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl -z-10" />
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius={70} outerRadius={90}
                paddingAngle={hasData ? 4 : 0} dataKey="value" startAngle={90} endAngle={-270} stroke="none">
                {donutData.map((entry, i) => <Cell key={i} fill={entry.color} strokeWidth={0} className="shadow-2xl" />)}
              </Pie>
              {hasData && (
                <Tooltip
                  contentStyle={{ borderRadius: 24, border: "1px solid var(--border)", backgroundColor: "var(--card)", fontSize: 12, fontWeight: 900 }}
                />
              )}
            </PieChart>
          </ResponsiveContainer>
          {/* Centre label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            {hasData ? (
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40 mb-1">Total Payload</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-black text-foreground tracking-tighter leading-none">{totalCal}</span>
                  <span className="text-xs font-black text-primary uppercase">kcal</span>
                </div>
              </div>
            ) : (
              <div className="text-center opacity-30">
                <span className="text-2xl font-black text-muted-foreground tracking-widest">AWAITING DATA</span>
              </div>
            )}
          </div>
        </div>

        {/* Per-macro progress bars */}
        <div className="space-y-10">
          {MACROS.map(({ key, label, icon, barColor, textColor, bgLight, calPerG, description }) => {
            const consumed = values[key]
            const target = targets[key]
            const pct = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0
            const cal = Math.round(consumed * calPerG)
            const over = target > 0 && consumed > target
            const remaining = Math.max(0, target - consumed)

            return (
              <div key={key} className="space-y-4">
                <div className="flex items-end justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-40">{description}</p>
                    <div className="flex items-center gap-3">
                      <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-xs shadow-lg",
                        key === "protein" && "bg-blue-500 shadow-blue-500/20",
                        key === "carbs" && "bg-amber-500 shadow-amber-500/20",
                        key === "fat" && "bg-emerald-500 shadow-emerald-500/20"
                      )}>
                        {icon}
                      </div>
                      <span className="text-sm font-black uppercase tracking-widest text-foreground">{label}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black tracking-tighter text-foreground">
                      {consumed}<span className="text-[10px] text-muted-foreground uppercase ml-1">/{target}g</span>
                    </p>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full",
                      over ? "bg-red-500/10 text-red-500 border border-red-500/10" : "bg-muted text-muted-foreground"
                    )}>
                      {pct}% Synced
                    </span>
                  </div>
                </div>
                <div className="h-3 rounded-full bg-muted/60 overflow-hidden p-0.5">
                  <div className="h-full rounded-full transition-all duration-1000 shadow-inner"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: over ? "#ef4444" : barColor,
                      boxShadow: `0 0 20px -5px ${over ? "#ef4444" : barColor}`
                    }} />
                </div>
                <div className="flex justify-between items-center opacity-60">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                    {cal} kcal generated
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-primary">
                    {over ? `${consumed - target}g limit exceed` : `${remaining}g to target`}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {!hasData && (
          <div className="text-center py-10 rounded-3xl bg-muted/20 border border-dashed border-border">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Structural analysis offline</p>
            <p className="text-xs font-medium text-muted-foreground mt-1">Log nutrients to initialize synthesis</p>
          </div>
        )}
      </div>
    </div>
  )
}