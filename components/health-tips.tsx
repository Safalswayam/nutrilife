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

  /* ── Sidebar Layout ── */
  return (
    <div className="p-10 space-y-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Lightbulb className="w-6 h-6 text-amber-500" />
          <p className="text-xl font-black uppercase tracking-tight">System Insight</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={rotateTip}
          className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-white/5"
        >
          <RefreshCw className={`w-5 h-5 transition-transform ${isRotating ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className={`transition-all duration-300 ${isRotating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
        <span className="inline-block px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full bg-amber-500/10 text-amber-500 mb-6 border border-amber-500/10">
          {currentTip.category}
        </span>
        <p className="text-lg font-bold text-foreground mb-8 leading-relaxed italic">"{currentTip.tip}"</p>

        <div className="flex items-start gap-4 p-6 rounded-3xl bg-muted/40 border border-white/5">
          <ChevronRight className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Tactical Recommendation</p>
            <p className="text-sm font-bold text-foreground leading-relaxed">
              {currentTip.action}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 mt-4">
        {healthTips.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentTipIndex(index)}
            className={`h-1 rounded-full transition-all ${index === currentTipIndex
              ? "bg-primary w-8"
              : "bg-muted-foreground/20 w-4 hover:bg-muted-foreground/40"
              }`}
          />
        ))}
      </div>
    </div>
  )
}
