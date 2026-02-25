"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, Flame, ChevronRight } from "lucide-react"
import Link from "next/link"

interface Meal {
  id: string
  name: string
  time: string
  calories: number
  image?: string
}

const recentMeals: Meal[] = [
  {
    id: "1",
    name: "Grilled Chicken Salad",
    time: "2 hours ago",
    calories: 450,
  },
  {
    id: "2",
    name: "Oatmeal with Berries",
    time: "6 hours ago",
    calories: 320,
  },
  {
    id: "3",
    name: "Salmon with Vegetables",
    time: "Yesterday",
    calories: 580,
  },
]

export function RecentMeals() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Recent Meals</CardTitle>
          <Link
            href="/food-analysis"
            className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
          >
            View all
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentMeals.map((meal) => (
            <div
              key={meal.id}
              className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                <Flame className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{meal.name}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{meal.time}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-foreground">{meal.calories}</p>
                <p className="text-xs text-muted-foreground">kcal</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
