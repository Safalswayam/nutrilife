"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts"

interface NutritionData {
  name: string
  value: number
  color: string
}

interface NutritionChartProps {
  data?: NutritionData[]
  title?: string
}

const defaultData: NutritionData[] = [
  { name: "Protein", value: 25, color: "oklch(0.55 0.16 145)" },
  { name: "Carbs", value: 45, color: "oklch(0.65 0.18 85)" },
  { name: "Fat", value: 20, color: "oklch(0.6 0.12 180)" },
  { name: "Fiber", value: 10, color: "oklch(0.7 0.15 120)" },
]

export function NutritionChart({
  data = defaultData,
  title = "Daily Nutrition",
}: NutritionChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "oklch(1 0 0)",
                  border: "1px solid oklch(0.88 0.03 145)",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                formatter={(value: number) => [`${value}g`, ""]}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => (
                  <span style={{ color: "oklch(0.4 0.04 145)", fontSize: "14px" }}>
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function MacroBreakdown({
  protein = 120,
  carbs = 200,
  fat = 65,
  fiber = 30,
}: {
  protein?: number
  carbs?: number
  fat?: number
  fiber?: number
}) {
  const macros = [
    { name: "Protein", value: protein, unit: "g", color: "bg-chart-1" },
    { name: "Carbs", value: carbs, unit: "g", color: "bg-chart-2" },
    { name: "Fat", value: fat, unit: "g", color: "bg-chart-3" },
    { name: "Fiber", value: fiber, unit: "g", color: "bg-chart-4" },
  ]

  const total = protein + carbs + fat + fiber

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Macro Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {macros.map((macro) => {
            const percentage = Math.round((macro.value / total) * 100)
            return (
              <div key={macro.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">
                    {macro.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {macro.value}
                    {macro.unit} ({percentage}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${macro.color} transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
