"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Lightbulb, ChevronRight, RefreshCw } from "lucide-react"

const healthTips = [
  {
    category: "Nutrition",
    tip: "Eat a rainbow of fruits and vegetables daily to ensure you get a variety of vitamins and antioxidants.",
    action: "Try adding one new vegetable to your meals this week.",
  },
  {
    category: "Hydration",
    tip: "Drink water before meals to help with portion control and improve digestion.",
    action: "Aim for a glass of water 30 minutes before each meal.",
  },
  {
    category: "Sleep",
    tip: "Quality sleep is essential for metabolism and weight management. Poor sleep can increase hunger hormones.",
    action: "Set a consistent bedtime and wake time, even on weekends.",
  },
  {
    category: "Exercise",
    tip: "Short walks after meals can help regulate blood sugar and improve digestion.",
    action: "Take a 15-minute walk after your largest meal today.",
  },
  {
    category: "Mindful Eating",
    tip: "Eating slowly and without distractions helps you recognize fullness signals better.",
    action: "Put your fork down between bites and chew each bite 20 times.",
  },
  {
    category: "Protein",
    tip: "Including protein with every meal helps maintain muscle mass and keeps you feeling full longer.",
    action: "Add a protein source to your next snack.",
  },
  {
    category: "Fiber",
    tip: "Fiber helps maintain digestive health and can help control blood sugar levels.",
    action: "Choose whole grains over refined grains at your next meal.",
  },
  {
    category: "Stress Management",
    tip: "Chronic stress can lead to emotional eating and weight gain. Managing stress is key to health.",
    action: "Try 5 minutes of deep breathing before your next meal.",
  },
]

export function HealthTips() {
  const [currentTipIndex, setCurrentTipIndex] = useState(0)
  const [isRotating, setIsRotating] = useState(false)

  const rotateTip = () => {
    setIsRotating(true)
    setTimeout(() => {
      setCurrentTipIndex((prev) => (prev + 1) % healthTips.length)
      setIsRotating(false)
    }, 300)
  }

  useEffect(() => {
    const interval = setInterval(rotateTip, 10000)
    return () => clearInterval(interval)
  }, [])

  const currentTip = healthTips[currentTipIndex]

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="w-5 h-5 text-accent" />
            Daily Health Tip
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={rotateTip}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`w-4 h-4 transition-transform ${isRotating ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className={`transition-opacity duration-300 ${isRotating ? "opacity-0" : "opacity-100"}`}
        >
          <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary mb-3">
            {currentTip.category}
          </span>
          <p className="text-foreground mb-4 leading-relaxed">{currentTip.tip}</p>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
            <ChevronRight className="w-5 h-5 text-primary flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Action: </span>
              {currentTip.action}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-1 mt-4">
          {healthTips.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentTipIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentTipIndex
                  ? "bg-primary w-4"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
