"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Droplets, Plus, Minus, Settings, Target, TrendingUp, Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { getApiUrl } from "@/lib/api"
import { toast } from "sonner"

interface EnhancedWaterIntakeProps {
  current?: number
  goal?: number
  onUpdate?: (newValue: number) => void
}

export function EnhancedWaterIntake({ onUpdate, current: initialCurrent, goal: initialGoal }: EnhancedWaterIntakeProps) {
  const { token } = useAuth()
  const [current, setCurrent] = useState(initialCurrent ?? 0)
  const [goal, setGoal] = useState(initialGoal ?? 8)
  const [isAdjusting, setIsAdjusting] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [newGoal, setNewGoal] = useState(8)
  const [loading, setLoading] = useState(true)
  const [showCelebration, setShowCelebration] = useState(false)

  useEffect(() => {
    fetchWaterIntake()
  }, [token])


  const fetchWaterIntake = async () => {
    try {
      const response = await fetch(getApiUrl("/api/water/today"), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setCurrent(Number(data.current ?? data.glasses ?? 0))
        setGoal(Number(data.goal ?? data.target ?? 8))
        setNewGoal(Number(data.goal ?? data.target ?? 8))

      }
    } catch (error) {
      console.error("Failed to fetch water intake:", error)
    } finally {
      setLoading(false)
    }
  }

  const adjustWater = async (adjustment: number) => {
    if (current === 0 && adjustment === -1) {
      toast.error("Water intake cannot be negative")
      return
    }

    setIsAdjusting(true)

    // Optimistic update
    const previousCurrent = current
    const newCurrent = Math.max(0, current + adjustment)
    setCurrent(newCurrent)

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
        setCurrent(data.current)
        
        // Show celebration when goal reached
        if (data.goal_reached && !previousGoalReached) {
          setShowCelebration(true)
          setTimeout(() => setShowCelebration(false), 3000)
        }

        toast.success(
          adjustment > 0
            ? `Added 1 glass! (${data.current}/${data.goal})`
            : `Removed 1 glass (${data.current}/${data.goal})`
        )
        
        onUpdate?.(data.current)
      } else {
        // Revert on failure
        setCurrent(previousCurrent)
        toast.error("Failed to update water intake")
      }
    } catch (error) {
      // Revert on error
      setCurrent(previousCurrent)
      toast.error("Network error. Please try again.")
    } finally {
      setIsAdjusting(false)
    }
  }

  const handleSetGoal = async () => {
    if (newGoal < 1 || newGoal > 20) {
      toast.error("Goal must be between 1 and 20 glasses")
      return
    }

    try {
      const response = await fetch(getApiUrl("/api/water/set-goal"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ goal: newGoal })
      })

      const data = await response.json()

      if (data.success) {
        setGoal(data.goal)
        setShowSettings(false)
        toast.success(`Daily goal set to ${newGoal} glasses`)
      }
    } catch (error) {
      toast.error("Failed to update goal")
    }
  }

  const safeCurrent = Number(current ?? 0)
  const safeGoal = Number(goal ?? 1)
  const percentage =
  safeGoal > 0
    ? Math.min(100, (safeCurrent / safeGoal) * 100)
    : 0

  const isGoalReached = current >= goal
  const previousGoalReached = (safeCurrent - 1) >= safeGoal

  // Calculate fill height for glass visual
  const fillHeight = percentage

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className={`transition-all ${isGoalReached ? "border-primary bg-primary/5" : ""}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Droplets className={`w-5 h-5 ${isGoalReached ? "text-primary" : "text-blue-500"}`} />
              Water Intake Today
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(true)}
              className="h-8 w-8"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Animated Glass Visual */}
          <div className="flex items-center justify-center">
            <div className="relative w-32 h-48">
              {/* Glass Container */}
              <div className="absolute inset-0 rounded-b-3xl border-4 border-blue-200 bg-gradient-to-b from-transparent to-blue-50/20 overflow-hidden">
                {/* Water Fill */}
                <div
                  className={`absolute bottom-0 left-0 right-0 transition-all duration-500 ease-out ${
                    isGoalReached
                      ? "bg-gradient-to-t from-primary to-primary/70"
                      : "bg-gradient-to-t from-blue-400 to-blue-300"
                  }`}
                  style={{ height: `${fillHeight}%` }}
                >
                  {/* Water Wave Effect */}
                  <div className="absolute top-0 left-0 right-0 h-4 opacity-30">
                    <div
                      className="absolute inset-0 bg-white rounded-full"
                      style={{
                        animation: "wave 3s ease-in-out infinite"
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Droplet Icon */}
              {fillHeight > 0 && (
                <div className="absolute top-4 right-4 animate-bounce">
                  <Droplets className="w-6 h-6 text-blue-400 drop-shadow-lg" />
                </div>
              )}

              {/* Glass Count Overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl font-bold text-foreground drop-shadow-md">
                  {current}
                </span>
                <span className="text-xs text-muted-foreground drop-shadow">
                  of {goal} glasses
                </span>
              </div>
            </div>
          </div>

          {/* Progress Circle */}
          <div className="relative w-40 h-40 mx-auto">
            <svg className="w-full h-full transform -rotate-90">
              {/* Background Circle */}
              <circle
                cx="80"
                cy="80"
                r="70"
                className="fill-none stroke-muted stroke-[8]"
              />
              {/* Progress Circle */}
              <circle
                cx="80"
                cy="80"
                r="70"
                className={`fill-none stroke-[8] transition-all duration-500 ${
                  isGoalReached ? "stroke-primary" : "stroke-blue-500"
                }`}
                strokeDasharray={`${2 * Math.PI * 70}`}
                strokeDashoffset={`${2 * Math.PI * 70 * (1 - percentage / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{Math.round(percentage)}%</span>
              <span className="text-xs text-muted-foreground">Complete</span>
            </div>
          </div>

          {/* Goal Status */}
          {isGoalReached ? (
            <div className="text-center animate-pulse">
              <p className="text-lg font-semibold text-primary">
                Daily goal reached!
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Great job staying hydrated!
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {goal - current} {goal - current === 1 ? "glass" : "glasses"} to go
              </p>
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => adjustWater(-1)}
              disabled={isAdjusting || current === 0}
              className="h-14 w-14 rounded-full hover:bg-destructive/10 hover:border-destructive hover:text-destructive disabled:opacity-50 transition-all"
            >
              {isAdjusting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Minus className="w-6 h-6" />
              )}
            </Button>

            <div className="text-center min-w-[100px]">
              <p className="text-2xl font-bold">{current}</p>
              <p className="text-xs text-muted-foreground">
                {current === 1 ? "glass" : "glasses"}
              </p>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => adjustWater(1)}
              disabled={isAdjusting}
              className="h-14 w-14 rounded-full hover:bg-primary/10 hover:border-primary hover:text-primary transition-all"
            >
              {isAdjusting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Plus className="w-6 h-6" />
              )}
            </Button>
          </div>

          {/* Encouragement Messages */}
          {!isGoalReached && (
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {current === 0
                  ? "Start your hydration journey!"
                  : current < goal / 2
                  ? "Keep going! You're making progress"
                  : "Almost there! Stay hydrated"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Goal Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Set Daily Water Goal
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="goal">Daily Goal (glasses)</Label>
              <Input
                id="goal"
                type="number"
                min={1}
                max={20}
                value={newGoal}
                onChange={(e) => setNewGoal(parseInt(e.target.value) || 8)}
                className="text-lg"
              />
              <p className="text-xs text-muted-foreground">
                Recommended: 8 glasses per day (2 liters)
              </p>
            </div>

            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm font-medium mb-1">Quick Tips:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• 1 glass ≈ 250ml (8 oz)</li>
                <li>• Drink water regularly throughout the day</li>
                <li>• Increase intake during exercise</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetGoal}>
              Save Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Celebration Animation */}
      {showCelebration && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="text-6xl animate-bounce">
            <Droplets className="w-16 h-16 text-primary" />
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes wave {
          0%, 100% {
            transform: translateY(0) scaleX(1);
          }
          50% {
            transform: translateY(-4px) scaleX(1.1);
          }
        }
      `}</style>
    </>
  )
}