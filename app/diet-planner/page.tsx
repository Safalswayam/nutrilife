"use client"

import React from "react"

import { useState, useEffect } from "react"
import { getApiUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Calculator,
  Loader2,
  Scale,
  Ruler,
  Activity,
  Target,
  Flame,
  Utensils,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Zap,
  Save,
  Clock,
  Moon,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface MealPlan {
  meal: string
  time: string
  foods: string[]
  calories: number
  protein: number
  carbs: number
  fat: number
}

interface DayPlan {
  day: string
  meals: MealPlan[]
  totalCalories: number
}

interface DietPlanResult {
  bmi: number
  bmiCategory: string
  bmr: number
  tdee: number
  targetCalories: number
  macros: {
    protein: number
    carbs: number
    fat: number
  }
  weeklyPlan: DayPlan[]
  tips: string[]
  warnings: string[]
}

interface FastingPlan {
  id: string
  name: string
  emoji: string
  fast_hours: number
  eat_hours: number
  category: string
  difficulty: string
  description: string
  suitable_for: string
  benefits: string[]
  tips: string[]
}

const getBMIColor = (bmi: number) => {
  if (bmi < 18.5) return "text-blue-600"
  if (bmi < 25) return "text-primary"
  if (bmi < 30) return "text-accent"
  return "text-destructive"
}

const getBMIBgColor = (bmi: number) => {
  if (bmi < 18.5) return "bg-blue-100"
  if (bmi < 25) return "bg-primary/10"
  if (bmi < 30) return "bg-accent/10"
  return "bg-destructive/10"
}

const difficultyColor: Record<string, string> = {
  None: "bg-gray-100 text-gray-600",
  Easy: "bg-green-100 text-green-700",
  Moderate: "bg-yellow-100 text-yellow-700",
  Hard: "bg-orange-100 text-orange-700",
  "Very Hard": "bg-red-100 text-red-700",
  Extreme: "bg-purple-100 text-purple-700",
}

export default function DietPlannerPage() {
  const { token } = useAuth()
  const [formData, setFormData] = useState({
    gender: "",
    height: "",
    weight: "",
    age: "",
    activityLevel: "",
    metabolismType: "",
    goal: "",
    dietType: "non_veg",
    fastingPlan: "none",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<DietPlanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Fasting plans state
  const [fastingPlans, setFastingPlans] = useState<FastingPlan[]>([])
  const [selectedFastingPlan, setSelectedFastingPlan] = useState<FastingPlan | null>(null)
  const [loadingFasting, setLoadingFasting] = useState(false)

  // Load fasting plans on mount
  useEffect(() => {
    const loadFastingPlans = async () => {
      setLoadingFasting(true)
      try {
        const res = await fetch(getApiUrl("/api/fasting/plans"))
        if (res.ok) {
          const data = await res.json()
          setFastingPlans(data.plans || [])
        }
      } catch (err) {
        console.error("Failed to load fasting plans:", err)
      } finally {
        setLoadingFasting(false)
      }
    }
    loadFastingPlans()
  }, [])

  // Update selected fasting plan details when selection changes
  useEffect(() => {
    if (formData.fastingPlan && fastingPlans.length > 0) {
      const plan = fastingPlans.find(p => p.id === formData.fastingPlan)
      setSelectedFastingPlan(plan || null)
    }
  }, [formData.fastingPlan, fastingPlans])

  const saveDietPlan = async () => {
    if (!result || !token) return

    setIsSaving(true)
    try {
      const response = await fetch(getApiUrl("/api/diet-plan/save"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          target_calories: result.targetCalories,
          macros: result.macros,
          weekly_plan: result.weeklyPlan
        })
      })

      const data = await response.json()

      if (data.success) {
        // Also save fasting plan preference to backend if user chose one
        if (formData.fastingPlan !== "none" && token) {
          try {
            await fetch(getApiUrl("/api/fasting/set-plan"), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ plan_id: formData.fastingPlan }),
            })
          } catch {
            // Non-fatal
          }
        }
        setSaveSuccess(true)
        setTimeout(() => {
          setShowConfirmDialog(false)
          setSaveSuccess(false)
        }, 2000)
      }
    } catch (error) {
      console.error("Failed to save diet plan:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(getApiUrl("/api/diet-plan"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender: formData.gender,
          height: Number(formData.height),
          weight: Number(formData.weight),
          age: Number(formData.age),
          activity_level: formData.activityLevel,
          metabolism_type: formData.metabolismType,
          goal: formData.goal,
          diet_type: formData.dietType,
          dietary_restrictions: [],
          fasting_plan: formData.fastingPlan,
        }),
      })

      const text = await response.text()
      let data: any = null

      try {
        data = text ? JSON.parse(text) : null
      } catch {
        throw new Error("Server returned an invalid response")
      }

      if (!response.ok) {
        throw new Error(data?.detail || "Failed to generate diet plan")
      }

      const transformedResult: DietPlanResult = {
        bmi: data.bmi_result.bmi,
        bmiCategory: data.bmi_result.category,
        bmr: Math.round(data.bmr),
        tdee: Math.round(data.tdee),
        targetCalories: data.target_calories,
        macros: {
          protein: data.macro_targets.protein,
          carbs: data.macro_targets.carbs,
          fat: data.macro_targets.fat,
        },
        weeklyPlan: data.weekly_plan.map((day: any) => ({
          day: day.day,
          meals: [
            { meal: "Breakfast", time: "7:00 AM", foods: day.breakfast.ingredients, calories: day.breakfast.calories, protein: day.breakfast.protein, carbs: day.breakfast.carbs, fat: day.breakfast.fat },
            { meal: "Morning Snack", time: "10:00 AM", foods: day.morning_snack.ingredients, calories: day.morning_snack.calories, protein: day.morning_snack.protein, carbs: day.morning_snack.carbs, fat: day.morning_snack.fat },
            { meal: "Lunch", time: "12:30 PM", foods: day.lunch.ingredients, calories: day.lunch.calories, protein: day.lunch.protein, carbs: day.lunch.carbs, fat: day.lunch.fat },
            { meal: "Afternoon Snack", time: "3:30 PM", foods: day.afternoon_snack.ingredients, calories: day.afternoon_snack.calories, protein: day.afternoon_snack.protein, carbs: day.afternoon_snack.carbs, fat: day.afternoon_snack.fat },
            { meal: "Dinner", time: "7:00 PM", foods: day.dinner.ingredients, calories: day.dinner.calories, protein: day.dinner.protein, carbs: day.dinner.carbs, fat: day.dinner.fat },
          ],
          totalCalories: day.total_calories,
        })),
        tips: data.tips,
        warnings: [],
      }

      setResult(transformedResult)
      setExpandedDay(transformedResult.weeklyPlan[0]?.day || null)
      setShowConfirmDialog(true)
    } catch (err) {
      console.error("[v0] Diet plan error:", err)
      let errorMsg = "An error occurred"
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        errorMsg = "Backend server is not running. Please start it with: uvicorn api.index:app --reload"
      } else if (err instanceof Error) {
        errorMsg = err.message
      }
      setError(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  const isFormValid =
    formData.gender &&
    formData.height &&
    formData.weight &&
    formData.age &&
    formData.activityLevel &&
    formData.metabolismType &&
    formData.goal

  return (
    <>
      <div className="p-3 md:p-8">
        <PageHeader
          title="Diet Planner"
          subtitle="Calculate your BMI and get a personalized diet plan based on your goals"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Form Section */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                Your Profile
              </CardTitle>
              <CardDescription>
                Enter your details to calculate BMI and generate a personalized diet plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Gender */}
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, gender: value }))}
                  >
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Age */}
                <div className="space-y-2">
                  <Label htmlFor="age">Age (years)</Label>
                  <Input
                    id="age"
                    type="number"
                    placeholder="e.g., 25"
                    min="10"
                    max="100"
                    value={formData.age}
                    onChange={(e) => setFormData((prev) => ({ ...prev, age: e.target.value }))}
                  />
                </div>

                {/* Height */}
                <div className="space-y-2">
                  <Label htmlFor="height" className="flex items-center gap-2">
                    <Ruler className="w-4 h-4" />
                    Height (cm)
                  </Label>
                  <Input
                    id="height"
                    type="number"
                    placeholder="e.g., 170"
                    min="100"
                    max="250"
                    value={formData.height}
                    onChange={(e) => setFormData((prev) => ({ ...prev, height: e.target.value }))}
                  />
                </div>

                {/* Weight */}
                <div className="space-y-2">
                  <Label htmlFor="weight" className="flex items-center gap-2">
                    <Scale className="w-4 h-4" />
                    Weight (kg)
                  </Label>
                  <Input
                    id="weight"
                    type="number"
                    placeholder="e.g., 70"
                    min="25"
                    max="300"
                    value={formData.weight}
                    onChange={(e) => setFormData((prev) => ({ ...prev, weight: e.target.value }))}
                  />
                </div>

                {/* Activity Level */}
                <div className="space-y-2">
                  <Label htmlFor="activity" className="flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Activity Level
                  </Label>
                  <Select
                    value={formData.activityLevel}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, activityLevel: value }))}
                  >
                    <SelectTrigger id="activity">
                      <SelectValue placeholder="Select activity level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sedentary">Sedentary (little exercise)</SelectItem>
                      <SelectItem value="light">Light (1-3 days/week)</SelectItem>
                      <SelectItem value="moderate">Moderate (3-5 days/week)</SelectItem>
                      <SelectItem value="active">Active (6-7 days/week)</SelectItem>
                      <SelectItem value="very_active">Very Active (intense daily)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Metabolism Type */}
                <div className="space-y-2">
                  <Label htmlFor="metabolism" className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Metabolism Type
                  </Label>
                  <Select
                    value={formData.metabolismType}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, metabolismType: value }))}
                  >
                    <SelectTrigger id="metabolism">
                      <SelectValue placeholder="How easily do you gain weight?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fast">Fast (gain weight slowly)</SelectItem>
                      <SelectItem value="normal">Normal (balanced)</SelectItem>
                      <SelectItem value="slow">Slow (gain weight easily)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Do you gain weight quickly or only after prolonged overeating?
                  </p>
                </div>

                {/* Goal */}
                <div className="space-y-2">
                  <Label htmlFor="goal" className="flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Your Goal
                  </Label>
                  <Select
                    value={formData.goal}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, goal: value }))}
                  >
                    <SelectTrigger id="goal">
                      <SelectValue placeholder="Select your goal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lose">Lose Weight</SelectItem>
                      <SelectItem value="maintain">Maintain Weight</SelectItem>
                      <SelectItem value="gain">Gain Muscle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Diet Type */}
                <div className="space-y-2">
                  <Label htmlFor="diet-type" className="flex items-center gap-2">
                    <Utensils className="w-4 h-4" />
                    Diet Preference
                  </Label>
                  <Select
                    value={formData.dietType}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, dietType: value }))}
                  >
                    <SelectTrigger id="diet-type">
                      <SelectValue placeholder="Select diet type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="non_veg">🍗 Non-Vegetarian</SelectItem>
                      <SelectItem value="veg">🥦 Vegetarian</SelectItem>
                      <SelectItem value="vegan">🌱 Vegan</SelectItem>
                      <SelectItem value="jain">🙏 Jain</SelectItem>
                      <SelectItem value="indian_non_veg">🇮🇳 Indian Non-Veg (No Beef)</SelectItem>
                      <SelectItem value="halal">☪️ Halal / Muslim (No Pork)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {formData.dietType === "veg" && "No meat, fish, or eggs. Dairy products allowed."}
                    {formData.dietType === "non_veg" && "Includes chicken, fish, eggs, and dairy."}
                    {formData.dietType === "vegan" && "No animal products — no meat, dairy, eggs, or honey."}
                    {formData.dietType === "jain" && "No meat, no root vegetables (onion, garlic, potato, carrot). Dairy allowed."}
                    {formData.dietType === "indian_non_veg" && "No beef or buffalo meat. Chicken, mutton, fish, eggs & dairy with Indian flavours."}
                    {formData.dietType === "halal" && "No pork or pork products. Halal chicken, beef, mutton, fish & dairy only."}
                  </p>
                </div>

                {/* ── FASTING PLAN ──────────────────────────────────────────── */}
                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="fasting-plan" className="flex items-center gap-2 font-semibold">
                    <Moon className="w-4 h-4 text-indigo-500" />
                    Fasting Protocol (Optional)
                  </Label>
                  <Select
                    value={formData.fastingPlan}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, fastingPlan: value }))}
                  >
                    <SelectTrigger id="fasting-plan">
                      <SelectValue placeholder="No fasting (default)" />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingFasting ? (
                        <SelectItem value="none" disabled>Loading plans...</SelectItem>
                      ) : fastingPlans.length > 0 ? (
                        fastingPlans.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.emoji} {plan.name}
                            {plan.fast_hours > 0 && (
                              <span className="text-muted-foreground ml-1 text-xs">
                                ({plan.fast_hours}h fast)
                              </span>
                            )}
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="none">🍽️ No Fasting</SelectItem>
                          <SelectItem value="12:12">🌙 12:12 Beginner (12h fast)</SelectItem>
                          <SelectItem value="14:10">🕑 14:10 Beginner+ (14h fast)</SelectItem>
                          <SelectItem value="16:8">⏰ 16:8 Leangains (16h fast)</SelectItem>
                          <SelectItem value="18:6">🔥 18:6 Advanced (18h fast)</SelectItem>
                          <SelectItem value="20:4">⚔️ 20:4 Warrior Diet (20h fast)</SelectItem>
                          <SelectItem value="omad">🥗 OMAD (23h fast)</SelectItem>
                          <SelectItem value="5:2">📅 5:2 Diet (2 low-cal days/week)</SelectItem>
                          <SelectItem value="alternate">🔄 Alternate Day Fasting</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>

                  {/* Fasting plan details card */}
                  {selectedFastingPlan && selectedFastingPlan.id !== "none" && (
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-800 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-indigo-800 dark:text-indigo-200">
                          {selectedFastingPlan.emoji} {selectedFastingPlan.name}
                        </span>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          difficultyColor[selectedFastingPlan.difficulty] || "bg-gray-100 text-gray-600"
                        )}>
                          {selectedFastingPlan.difficulty}
                        </span>
                      </div>
                      <p className="text-xs text-indigo-700 dark:text-indigo-300">{selectedFastingPlan.description}</p>
                      {selectedFastingPlan.fast_hours > 0 && (
                        <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400">
                          <Clock className="w-3 h-3" />
                          <span>
                            Fast: <strong>{selectedFastingPlan.fast_hours}h</strong> &nbsp;|&nbsp;
                            Eat: <strong>{selectedFastingPlan.eat_hours}h</strong>
                          </span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        <strong>Best for:</strong> {selectedFastingPlan.suitable_for}
                      </p>
                      {selectedFastingPlan.benefits.length > 0 && (
                        <ul className="text-xs space-y-1 text-indigo-700 dark:text-indigo-300">
                          {selectedFastingPlan.benefits.slice(0, 3).map((b, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              {b}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    If selected, the diet plan will be adjusted to fit your fasting window.
                  </p>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={!isFormValid || isLoading}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-4 h-4 mr-2" />
                      Generate Diet Plan
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Results Section */}
          <div className="lg:col-span-2 space-y-6">
            {result ? (
              <>
                {/* Fasting protocol badge (if active) */}
                {formData.fastingPlan !== "none" && selectedFastingPlan && (
                  <Alert className="bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800">
                    <Moon className="w-4 h-4 text-indigo-600" />
                    <AlertTitle className="text-indigo-800 dark:text-indigo-200">
                      Fasting Protocol Active: {selectedFastingPlan.emoji} {selectedFastingPlan.name}
                    </AlertTitle>
                    <AlertDescription className="text-indigo-700 dark:text-indigo-300">
                      This meal plan has been generated to fit your{" "}
                      {selectedFastingPlan.fast_hours > 0
                        ? `${selectedFastingPlan.fast_hours}-hour fasting window`
                        : "fasting schedule"}
                      .
                    </AlertDescription>
                  </Alert>
                )}

                {/* BMI and Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className={cn("relative overflow-hidden", getBMIBgColor(result.bmi))}>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground mb-1">Your BMI</p>
                      <p className={cn("text-3xl font-bold", getBMIColor(result.bmi))}>{result.bmi}</p>
                      <p className={cn("text-sm font-medium", getBMIColor(result.bmi))}>{result.bmiCategory}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground mb-1">BMR</p>
                      <p className="text-3xl font-bold text-foreground">{result.bmr}</p>
                      <p className="text-sm text-muted-foreground">kcal/day</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground mb-1">TDEE</p>
                      <p className="text-3xl font-bold text-foreground">{result.tdee}</p>
                      <p className="text-sm text-muted-foreground">kcal/day</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-primary text-primary-foreground">
                    <CardContent className="p-4">
                      <p className="text-sm opacity-80 mb-1">Target</p>
                      <p className="text-3xl font-bold">{result.targetCalories}</p>
                      <p className="text-sm opacity-80">kcal/day</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Macros */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Flame className="w-5 h-5 text-primary" />
                      Daily Macronutrient Targets
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 rounded-xl bg-chart-1/10">
                        <p className="text-3xl font-bold text-chart-1">{result.macros.protein}g</p>
                        <p className="text-sm text-muted-foreground">Protein</p>
                      </div>
                      <div className="text-center p-4 rounded-xl bg-chart-2/10">
                        <p className="text-3xl font-bold text-chart-2">{result.macros.carbs}g</p>
                        <p className="text-sm text-muted-foreground">Carbohydrates</p>
                      </div>
                      <div className="text-center p-4 rounded-xl bg-chart-3/10">
                        <p className="text-3xl font-bold text-chart-3">{result.macros.fat}g</p>
                        <p className="text-sm text-muted-foreground">Fat</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Warnings */}
                {result.warnings.length > 0 && (
                  <Alert className="bg-accent/10 border-accent/30">
                    <AlertTriangle className="w-4 h-4 text-accent" />
                    <AlertTitle className="text-accent-foreground">Important Notes</AlertTitle>
                    <AlertDescription>
                      <ul className="mt-2 space-y-1">
                        {result.warnings.map((warning, index) => (
                          <li key={index} className="text-sm text-foreground">{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Weekly Meal Plan */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Utensils className="w-5 h-5 text-primary" />
                      7-Day Meal Plan
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {result.weeklyPlan.map((day) => (
                      <div key={day.day} className="border border-border rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedDay(expandedDay === day.day ? null : day.day)}
                          className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <span className="font-bold text-primary">{day.day.charAt(0)}</span>
                            </div>
                            <div className="text-left">
                              <p className="font-medium text-foreground">{day.day}</p>
                              <p className="text-sm text-muted-foreground">{day.meals.length} meals</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-semibold text-foreground">{day.totalCalories}</p>
                              <p className="text-xs text-muted-foreground">kcal</p>
                            </div>
                            {expandedDay === day.day ? (
                              <ChevronUp className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        </button>

                        {expandedDay === day.day && (
                          <div className="border-t border-border p-4 space-y-4 bg-muted/30">
                            {day.meals.map((meal, mealIndex) => (
                              <div key={mealIndex} className="bg-card p-4 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-semibold text-foreground">{meal.meal}</h4>
                                  <span className="text-sm text-muted-foreground">{meal.time}</span>
                                </div>
                                <ul className="text-sm text-muted-foreground mb-3 space-y-1">
                                  {meal.foods.map((food, foodIndex) => (
                                    <li key={foodIndex} className="flex items-center gap-2">
                                      <CheckCircle className="w-3 h-3 text-primary" />
                                      {food}
                                    </li>
                                  ))}
                                </ul>
                                <div className="flex flex-wrap gap-2">
                                  <span className="px-2 py-1 text-xs rounded-full bg-chart-1/20 text-chart-1">{meal.calories} kcal</span>
                                  <span className="px-2 py-1 text-xs rounded-full bg-chart-2/20 text-chart-2">{meal.protein}g protein</span>
                                  <span className="px-2 py-1 text-xs rounded-full bg-chart-3/20 text-chart-3">{meal.carbs}g carbs</span>
                                  <span className="px-2 py-1 text-xs rounded-full bg-chart-4/20 text-chart-4">{meal.fat}g fat</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Tips */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Lightbulb className="w-5 h-5 text-accent" />
                      Personalized Tips
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {result.tips.map((tip, index) => (
                        <li key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                          <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-foreground">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="flex items-center justify-center min-h-[500px]">
                <CardContent className="text-center py-12">
                  <div className="w-20 h-20 mx-auto rounded-full bg-muted flex items-center justify-center mb-6">
                    <Calculator className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">Get Your Personalized Diet Plan</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Fill in your details on the left to calculate your BMI and receive a customized 7-day meal plan
                    tailored to your goals and metabolism type.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* ✅ Confirmation Dialog for Diet Plan Integration */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="w-5 h-5 text-primary" />
              Integrate Diet Plan to Dashboard?
            </DialogTitle>
            <DialogDescription>
              Do you want to integrate this diet plan into your dashboard?
              This will make your meal suggestions available on the home screen.
              {formData.fastingPlan !== "none" && selectedFastingPlan && (
                <span className="block mt-1 text-indigo-600 font-medium">
                  Your {selectedFastingPlan.name} fasting protocol will also be saved.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {saveSuccess ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
              <p className="text-green-600 font-medium">Diet Plan Saved Successfully!</p>
              <p className="text-sm text-muted-foreground">Go to Dashboard to see "What to Eat Next"</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  This will replace your current diet plan if one exists.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isSaving || saveSuccess}
            >
              {saveSuccess ? "Close" : "Cancel"}
            </Button>
            {!saveSuccess && (
              <Button onClick={saveDietPlan} disabled={isSaving} className="gap-2">
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Integrate to Dashboard
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}