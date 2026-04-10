"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Droplets, Plus, Minus, Loader2, CheckCircle } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { getApiUrl } from "@/lib/api"
import { toast } from "sonner"

interface WaterIntakeWidgetProps {
  currentGlasses: number
  targetGlasses: number
  onUpdate?: () => void
}

export function WaterIntakeWidget({ 
  currentGlasses, 
  targetGlasses,
  onUpdate 
}: WaterIntakeWidgetProps) {
  const { token } = useAuth()
  const [glasses, setGlasses] = useState(currentGlasses)
  const [isAdjusting, setIsAdjusting] = useState(false)

  const adjustWater = async (adjustment: number) => {
    // Prevent negative values on client side
    const newValue = Math.max(0, glasses + adjustment)
    
    if (glasses === 0 && adjustment === -1) {
      toast.error("Water intake cannot be negative")
      return
    }
    
    setIsAdjusting(true)
    
    // Optimistic update
    const previousGlasses = glasses
    setGlasses(newValue)
    
    try {
      const response = await fetch(getApiUrl("/api/water/adjust"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ adjustment })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setGlasses(data.current)
        toast.success(
          adjustment > 0 
            ? `Added 1 glass! (${data.current}/${targetGlasses})` 
            : `Removed 1 glass (${data.current}/${targetGlasses})`
        )
        // Trigger dashboard refresh
        onUpdate?.()
      } else {
        // Revert on failure
        setGlasses(previousGlasses)
        toast.error("Failed to update water intake")
      }
    } catch (error) {
      console.error("Water adjustment error:", error)
      // Revert on error
      setGlasses(previousGlasses)
      toast.error("Network error. Please try again.")
    } finally {
      setIsAdjusting(false)
    }
  }

  const percentage = Math.min(100, (glasses / targetGlasses) * 100)
  const isGoalReached = glasses >= targetGlasses

  return (
    <Card className={isGoalReached ? "border-primary bg-primary/5" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Droplets className={`w-5 h-5 ${isGoalReached ? 'text-primary' : 'text-muted-foreground'}`} />
          Water Intake Today
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Circle */}
        <div className="relative w-32 h-32 mx-auto">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              className="fill-none stroke-muted stroke-[8]"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              className={`fill-none stroke-[8] transition-all duration-500 ${
                isGoalReached ? 'stroke-primary' : 'stroke-blue-500'
              }`}
              strokeDasharray={`${2 * Math.PI * 56}`}
              strokeDashoffset={`${2 * Math.PI * 56 * (1 - percentage / 100)}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-foreground">{glasses}</span>
            <span className="text-xs text-muted-foreground">of {targetGlasses}</span>
            <span className="text-xs text-muted-foreground mt-0.5">glasses</span>
          </div>
        </div>

        {/* Goal Status */}
        {isGoalReached && (
          <div className="text-center">
            <p className="text-sm font-medium text-primary flex items-center gap-1.5 justify-center"><CheckCircle className="w-4 h-4" /> Daily goal reached!</p>
          </div>
        )}

        {/* +/- Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => adjustWater(-1)}
            disabled={isAdjusting || glasses === 0}
            className="h-12 w-12 rounded-full hover:bg-destructive/10 hover:border-destructive hover:text-destructive disabled:opacity-50"
            aria-label="Decrease water intake"
          >
            {isAdjusting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Minus className="w-5 h-5" />
            )}
          </Button>
          
          <div className="text-center min-w-[70px]">
            <p className="text-sm font-medium text-foreground">
              {glasses} glass{glasses !== 1 ? "es" : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {Math.round(percentage)}%
            </p>
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => adjustWater(1)}
            disabled={isAdjusting}
            className="h-12 w-12 rounded-full hover:bg-primary/10 hover:border-primary hover:text-primary"
            aria-label="Increase water intake"
          >
            {isAdjusting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{Math.round(percentage)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                isGoalReached ? 'bg-primary' : 'bg-blue-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Tip */}
        {!isGoalReached && glasses < targetGlasses / 2 && (
          <div className="text-center text-xs text-muted-foreground">
            Tip: Drink water regularly throughout the day
          </div>
        )}
      </CardContent>
    </Card>
  )
}
