"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
} from "recharts"

/* ─── Generic NutritionChart ─── */
interface NutritionData { name: string; value: number; color: string }

const defaultData: NutritionData[] = [
  { name: "Protein", value: 25, color: "#3b82f6" },
  { name: "Carbs",   value: 45, color: "#f59e0b" },
  { name: "Fat",     value: 20, color: "#10b981" },
  { name: "Fiber",   value: 10, color: "#8b5cf6" },
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
  { key: "protein" as const, label: "Protein", icon: "🥩", color: "#3b82f6", barColor: "#3b82f6", textColor: "#2563eb", bgLight: "#eff6ff", calPerG: 4, description: "Builds & repairs muscle" },
  { key: "carbs"   as const, label: "Carbs",   icon: "🌾", color: "#f59e0b", barColor: "#f59e0b", textColor: "#d97706", bgLight: "#fffbeb", calPerG: 4, description: "Primary energy source" },
  { key: "fat"     as const, label: "Fat",     icon: "🥑", color: "#10b981", barColor: "#10b981", textColor: "#059669", bgLight: "#ecfdf5", calPerG: 9, description: "Hormones & cell health" },
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
  const tCarbs   = targetCarbs   || Math.round(targetCalories * 0.45 / 4)
  const tFat     = targetFat     || Math.round(targetCalories * 0.25 / 9)
  const values   = { protein, carbs, fat }
  const targets  = { protein: tProtein, carbs: tCarbs, fat: tFat }

  const proteinCal = Math.round(protein * 4)
  const carbsCal   = Math.round(carbs   * 4)
  const fatCal     = Math.round(fat     * 9)
  const totalCal   = proteinCal + carbsCal + fatCal
  const hasData    = totalCal > 0

  const donutData = hasData
    ? [
        { name: "Protein", value: proteinCal, color: "#3b82f6" },
        { name: "Carbs",   value: carbsCal,   color: "#f59e0b" },
        { name: "Fat",     value: fatCal,      color: "#10b981" },
      ]
    : [{ name: "No data", value: 1, color: "#e5e7eb" }]

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Macro Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Donut chart */}
        <div className="relative h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius={52} outerRadius={72}
                paddingAngle={hasData ? 3 : 0} dataKey="value" startAngle={90} endAngle={-270} stroke="none">
                {donutData.map((entry, i) => <Cell key={i} fill={entry.color} strokeWidth={0} />)}
              </Pie>
              {hasData && (
                <Tooltip formatter={(value: number, name: string) => [`${value} kcal`, name]}
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e5e7eb" }} />
              )}
            </PieChart>
          </ResponsiveContainer>
          {/* Centre label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            {hasData ? (
              <><span className="text-2xl font-bold text-foreground leading-none">{totalCal}</span>
                <span className="text-xs text-muted-foreground mt-0.5">kcal today</span></>
            ) : (
              <><span className="text-xl font-bold text-muted-foreground leading-none">—</span>
                <span className="text-xs text-muted-foreground mt-0.5">no data yet</span></>
            )}
          </div>
        </div>

        {/* Calorie split cards */}
        {hasData && (
          <div className="grid grid-cols-3 gap-2">
            {MACROS.map(({ label, color, calPerG, key }) => {
              const cal = Math.round(values[key] * calPerG)
              const pct = totalCal > 0 ? Math.round((cal / totalCal) * 100) : 0
              return (
                <div key={label} className="text-center p-2.5 rounded-lg bg-muted/40">
                  <div className="w-3 h-3 rounded-full mx-auto mb-1" style={{ backgroundColor: color }} />
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-bold text-foreground">{cal} kcal</p>
                  <p className="text-[10px] text-muted-foreground">{pct}%</p>
                </div>
              )
            })}
          </div>
        )}

        {/* Per-macro progress bars */}
        <div className="space-y-4">
          {MACROS.map(({ key, label, icon, barColor, textColor, bgLight, calPerG, description }) => {
            const consumed = values[key]
            const target   = targets[key]
            const pct      = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0
            const cal      = Math.round(consumed * calPerG)
            const over     = target > 0 && consumed > target
            const remaining = Math.max(0, target - consumed)

            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{icon}</span>
                    <div>
                      <span className="text-sm font-semibold text-foreground">{label}</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5 hidden sm:inline">{description}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: textColor }}>{consumed}g</span>
                    <span className="text-xs text-muted-foreground">/ {target}g</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: over ? "#fee2e2" : bgLight, color: over ? "#dc2626" : textColor }}>
                      {pct}%
                    </span>
                  </div>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: over ? "#ef4444" : barColor }} />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{calPerG} kcal/g · {cal} kcal from {label.toLowerCase()}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {over ? `${consumed - target}g over` : `${remaining}g remaining`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {!hasData && (
          <p className="text-center text-xs text-muted-foreground py-1">
            Log meals to see your macro breakdown
          </p>
        )}

      </CardContent>
    </Card>
  )
}