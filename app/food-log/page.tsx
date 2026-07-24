"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/lib/auth-context"
import { getApiUrl } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  PlusCircle, Trash2, Loader2, Search, Flame,
  Beef, Wheat, Droplets, Utensils, Sun, Moon, Cookie, Sparkles, TrendingUp
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const QUICK_FOODS = [
  { name: "Rice (1 cup)", calories: 206, protein: 4.3, carbs: 45, fat: 0.4 },
  { name: "Dal (1 bowl)", calories: 198, protein: 12, carbs: 32, fat: 3 },
  { name: "Roti (1 piece)", calories: 104, protein: 3, carbs: 20, fat: 2 },
  { name: "Chicken Breast (100g)", calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: "Eggs (2 whole)", calories: 155, protein: 13, carbs: 1.1, fat: 11 },
  { name: "Banana", calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { name: "Apple", calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { name: "Milk (1 glass)", calories: 149, protein: 8, carbs: 12, fat: 8 },
  { name: "Bread (2 slices)", calories: 158, protein: 5.4, carbs: 30, fat: 2 },
  { name: "Omelette (2 eggs)", calories: 220, protein: 15, carbs: 2, fat: 17 },
  { name: "Salad (bowl)", calories: 152, protein: 4, carbs: 12, fat: 10 },
  { name: "Biryani (1 plate)", calories: 350, protein: 15, carbs: 48, fat: 12 },
  { name: "Butter Chicken", calories: 380, protein: 28, carbs: 12, fat: 25 },
  { name: "Paneer Tikka (100g)", calories: 260, protein: 18, carbs: 6, fat: 18 },
  { name: "Samosa (1 pc)", calories: 130, protein: 2, carbs: 15, fat: 7 },
  { name: "Idli (2 pcs)", calories: 130, protein: 4, carbs: 26, fat: 0.5 },
  { name: "Dosa (1 plain)", calories: 168, protein: 4, carbs: 30, fat: 4 },
  { name: "Upma (1 bowl)", calories: 200, protein: 5, carbs: 33, fat: 6 },
  { name: "Poha (1 plate)", calories: 250, protein: 4, carbs: 46, fat: 6 },
  { name: "Yogurt (1 cup)", calories: 100, protein: 17, carbs: 6, fat: 0.7 },
  { name: "Greek Yogurt (150g)", calories: 130, protein: 15, carbs: 6, fat: 5 },
  { name: "Oats (1 bowl)", calories: 150, protein: 6, carbs: 27, fat: 3 },
  { name: "Quinoa (1 cup)", calories: 222, protein: 8, carbs: 39, fat: 3.5 },
  { name: "Protein Shake (1 scoop)", calories: 120, protein: 24, carbs: 3, fat: 1.5 },
  { name: "Almonds (28g)", calories: 164, protein: 6, carbs: 6, fat: 14 },
  { name: "Avocado (medium)", calories: 240, protein: 3, carbs: 12, fat: 22 },
  { name: "Sweet Potato", calories: 112, protein: 2, carbs: 26, fat: 0.1 },
  { name: "Broccoli (1 cup)", calories: 31, protein: 2.5, carbs: 6, fat: 0.3 },
  { name: "Peanut Butter (1 tbsp)", calories: 94, protein: 4, carbs: 3, fat: 8 },
  { name: "Dark Chocolate (28g)", calories: 170, protein: 2, carbs: 13, fat: 12 },
  { name: "Tofu (100g)", calories: 76, protein: 8, carbs: 2, fat: 4.8 },
  { name: "Lentil Soup (bowl)", calories: 180, protein: 10, carbs: 30, fat: 2 },
  { name: "Pasta Carbonara", calories: 450, protein: 20, carbs: 50, fat: 20 },
  { name: "Fish Curry", calories: 280, protein: 22, carbs: 8, fat: 18 },
  { name: "Coffee / Tea (Plain)", calories: 5, protein: 0.2, carbs: 1, fat: 0.1 },
  { name: "Smoothie (Berry)", calories: 230, protein: 6, carbs: 45, fat: 3 },
]

const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast", icon: Sun, color: "text-primary", bg: "bg-primary/10" },
  { value: "lunch", label: "Lunch", icon: Utensils, color: "text-primary", bg: "bg-primary/10" },
  { value: "dinner", label: "Dinner", icon: Moon, color: "text-muted-foreground", bg: "bg-muted" },
  { value: "snack", label: "Snack", icon: Cookie, color: "text-primary", bg: "bg-primary/10" },
]

interface MealEntry {
  id: number
  food_name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  meal_type: string
  logged_at: string
}

const DEFAULT_GOAL = 2000

function getMealTypeByHour(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 10) return "breakfast"
  if (h >= 10 && h < 12) return "snack"
  if (h >= 12 && h < 15) return "lunch"
  if (h >= 15 && h < 18) return "snack"
  if (h >= 18 && h < 22) return "dinner"
  return "snack"
}

export default function FoodLogPage() {
  const { token, user } = useAuth()

  const [foodName, setFoodName] = useState("")
  const [calories, setCalories] = useState("")
  const [protein, setProtein] = useState("")
  const [carbs, setCarbs] = useState("")
  const [fat, setFat] = useState("")
  const [mealType, setMealType] = useState(getMealTypeByHour)
  const [searchQuery, setSearchQuery] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [meals, setMeals] = useState<MealEntry[]>([])
  const [loadingMeals, setLoadingMeals] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchTodaysMeals() }, [token])

  const fetchTodaysMeals = async () => {
    if (!token) { setLoadingMeals(false); return }
    try {
      const res = await fetch(getApiUrl("/api/meals/today"), {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) { const data = await res.json(); setMeals(data.meals || []) }
    } catch { toast.error("Failed to load today's meals") }
    finally { setLoadingMeals(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!foodName.trim()) { toast.error("Please enter a food name"); return }
    if (!calories || +calories <= 0) { toast.error("Please enter calories"); return }
    if (!token) { toast.error("Please log in first"); return }

    setSubmitting(true)
    try {
      const params = new URLSearchParams({
        food_name: foodName.trim(),
        calories: calories,
        protein: protein || "0",
        carbs: carbs || "0",
        fat: fat || "0",
        meal_type: mealType,
      })
      const res = await fetch(`${getApiUrl("/api/meals/log")}?${params}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error()
      toast.success(`${foodName} logged!`)
      setFoodName(""); setCalories(""); setProtein("")
      setCarbs(""); setFat(""); setSearchQuery("")
      nameInputRef.current?.focus()
      await fetchTodaysMeals()
    } catch {
      toast.error("Failed to log meal. Please try again.")
    } finally { setSubmitting(false) }
  }

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      const res = await fetch(getApiUrl(`/api/meals/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error()
      setMeals(prev => prev.filter(m => m.id !== id))
      toast.success("Entry removed")
    } catch { toast.error("Failed to delete entry") }
    finally { setDeletingId(null) }
  }

  const handleQuickPick = (food: typeof QUICK_FOODS[0]) => {
    setFoodName(food.name)
    setCalories(String(food.calories))
    setProtein(String(food.protein))
    setCarbs(String(food.carbs))
    setFat(String(food.fat))
    setSearchQuery("")
    nameInputRef.current?.focus()
  }

  const totalCalories = meals.reduce((s, m) => s + (m.calories || 0), 0)
  const totalProtein = meals.reduce((s, m) => s + (m.protein || 0), 0)
  const totalCarbs = meals.reduce((s, m) => s + (m.carbs || 0), 0)
  const totalFat = meals.reduce((s, m) => s + (m.fat || 0), 0)
  const calorieGoal = (user as any)?.target_calories || DEFAULT_GOAL
  const progressPct = Math.min(100, Math.round((totalCalories / calorieGoal) * 100))
  const remaining = calorieGoal - totalCalories

  const mealsByType = MEAL_TYPES.map(mt => ({
    ...mt,
    entries: meals.filter(m => m.meal_type === mt.value)
  }))

  const filteredQuick = searchQuery.trim()
    ? QUICK_FOODS.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : QUICK_FOODS

  return (
    <div className="p-3 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="reveal-3d">
        <PageHeader title="Food Log" subtitle="Track your daily food intake and refine your macros." />
      </div>

      {/* Stats Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 reveal-3d">
        <Card className="col-span-1 md:col-span-2 border-none glass-card rounded-[2.5rem] bg-gradient-to-br from-primary/10 to-transparent">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
              <div className="space-y-1">
                <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">Today's Intake</p>
                <p className="text-5xl font-black text-foreground">
                  {totalCalories.toLocaleString()} <span className="text-xl text-muted-foreground font-bold">/ {calorieGoal.toLocaleString()} kcal</span>
                </p>
              </div>
              <div className="text-right glass-card p-4 rounded-3xl min-w-[120px]">
                <p className="text-xs font-black text-muted-foreground uppercase mb-1">Remaining</p>
                <p className={cn("text-2xl font-black", remaining < 0 ? "text-destructive" : "text-primary")}>
                  {remaining < 0 ? "+" : ""}{Math.abs(remaining).toLocaleString()}
                </p>
              </div>
            </div>
            <Progress value={progressPct} className="h-4 rounded-full bg-primary/10 shadow-inner" />
            <div className="grid grid-cols-3 gap-4 mt-8">
              {[
                { label: "Protein", value: totalProtein, color: "text-[color:var(--chart-1)]", bg: "bg-[color:var(--chart-1)]/10", icon: Beef },
                { label: "Carbs", value: totalCarbs, color: "text-[color:var(--chart-2)]", bg: "bg-[color:var(--chart-2)]/10", icon: Wheat },
                { label: "Fat", value: totalFat, color: "text-[color:var(--chart-4)]", bg: "bg-[color:var(--chart-4)]/10", icon: Droplets },
              ].map((macro, i) => (
                <div key={i} className={cn("p-4 rounded-[2rem] glass-card flex flex-col items-center gap-1", macro.bg)}>
                  <macro.icon className={cn("w-5 h-5", macro.color)} />
                  <p className="text-[10px] font-black uppercase text-muted-foreground">{macro.label}</p>
                  <p className={cn("text-lg font-black", macro.color)}>{macro.value.toFixed(1)}g</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none glass-card rounded-[2.5rem] flex flex-col justify-center items-center text-center p-8">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <TrendingUp className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <h3 className="text-xl font-black mb-2">Track Consistency</h3>
          <p className="text-sm text-muted-foreground font-medium mb-6">Logging every meal increases success rates by 80%.</p>
          <div className="text-xs font-black uppercase tracking-widest text-primary px-4 py-2 bg-primary/10 rounded-full">
            Current Streak: 5 Days
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* ── LEFT: Add food ── */}
        <div className="lg:col-span-4 space-y-6 reveal-3d">
          {/* Quick pick */}
          <Card className="border-none glass-card rounded-[2.5rem]">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-lg font-black flex items-center gap-3">
                <Search className="w-5 h-5 text-primary" /> Quick Search
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2 space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rice, Biryani, Banana..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-11 h-12 rounded-2xl bg-white/5 border-none focus-visible:ring-primary/50"
                />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredQuick.map(food => (
                  <button
                    key={food.name}
                    onClick={() => handleQuickPick(food)}
                    className="w-full flex items-center justify-between p-3 rounded-2xl glass-card hover:bg-white/10 transition-all text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-black truncate">{food.name}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">{food.protein}g Protein</p>
                    </div>
                    <Badge className="bg-primary/20 text-primary border-none shadow-none font-black">{food.calories}kcal</Badge>
                  </button>
                ))}
                {filteredQuick.length === 0 && (
                  <div className="text-center py-8 opacity-40">
                    <p className="text-xs font-black uppercase tracking-widest">No results</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Manual Form */}
          <Card className="border-none glass-card rounded-[2.5rem]">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-lg font-black flex items-center gap-3">
                <PlusCircle className="w-5 h-5 text-primary" /> Custom Entry
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="food-name" className="text-xs font-black uppercase text-muted-foreground tracking-widest">Food Name</Label>
                  <Input id="food-name" ref={nameInputRef} placeholder="e.g. Scrambled Eggs" value={foodName} onChange={e => setFoodName(e.target.value)} className="h-12 rounded-2xl bg-white/5 border-none" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">Calories</Label>
                    <Input type="number" placeholder="kcal" value={calories} onChange={e => setCalories(e.target.value)} className="h-12 rounded-2xl bg-white/5 border-none" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">Meal</Label>
                    <Select value={mealType} onValueChange={setMealType}>
                      <SelectTrigger className="h-12 rounded-2xl bg-white/5 border-none"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-2xl glass-card">
                        {MEAL_TYPES.map(mt => (
                          <SelectItem key={mt.value} value={mt.value} className="rounded-xl">{mt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 py-2">
                  <Input type="number" placeholder="P (g)" value={protein} onChange={e => setProtein(e.target.value)} className="text-center bg-destructive/5 border-none rounded-xl" />
                  <Input type="number" placeholder="C (g)" value={carbs} onChange={e => setCarbs(e.target.value)} className="text-center bg-secondary border-none rounded-xl" />
                  <Input type="number" placeholder="F (g)" value={fat} onChange={e => setFat(e.target.value)} className="text-center bg-secondary border-none rounded-xl" />
                </div>

                <Button type="submit" size="lg" className="w-full h-14 rounded-[1.5rem] font-black text-lg gap-2 shadow-2xl shadow-primary/20" disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  {submitting ? "Logging..." : "Log Vital"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT: Log Entries ── */}
        <div className="lg:col-span-8 space-y-6 reveal-3d">
          {loadingMeals ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full"></div>
                <Loader2 className="w-12 h-12 animate-spin text-primary relative z-10" />
              </div>
              <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">Fetching your log...</p>
            </div>
          ) : meals.length === 0 ? (
            <div className="glass-card rounded-[3rem] py-32 flex flex-col items-center text-center px-8 border-dashed border-2 border-white/5">
              <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-8">
                <Utensils className="w-12 h-12 text-muted-foreground opacity-20" />
              </div>
              <h3 className="text-2xl font-black mb-2 tracking-tight">Your daily log is empty.</h3>
              <p className="text-muted-foreground font-medium max-w-sm">Capture your first vital using the entry panel or scan a meal photo for AI analysis.</p>
              <div className="mt-12 flex gap-4">
                <Button variant="outline" className="rounded-2xl border-white/10 glass-card">View History</Button>
                <Button className="rounded-2xl shadow-xl shadow-primary/20">Analyze Meal Photo</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {mealsByType.map(({ value, label, icon: Icon, entries, color, bg }) => {
                if (entries.length === 0) return null
                const mealCals = entries.reduce((s, e) => s + (e.calories || 0), 0)
                return (
                  <div key={value} className="space-y-4 reveal-3d">
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center", bg)}>
                          <Icon className={cn("w-5 h-5", color)} />
                        </div>
                        <h4 className="text-xl font-black tracking-tight">{label}</h4>
                      </div>
                      <div className="glass-card px-4 py-1 rounded-full flex items-center gap-2">
                        <Flame className="w-4 h-4 text-primary" />
                        <span className="text-sm font-black">{mealCals}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">kcal</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {entries.map(entry => (
                        <div key={entry.id} className="group relative glass-card p-5 rounded-[2rem] hover:bg-white/10 transition-all">
                          <div className="flex justify-between items-start mb-4">
                            <div className="space-y-1">
                              <p className="font-black text-lg leading-none capitalize">{entry.food_name}</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{new Date(entry.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            <button
                              onClick={() => handleDelete(entry.id)}
                              disabled={deletingId === entry.id}
                              className="p-2 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all opacity-0 group-hover:opacity-100"
                            >
                              {deletingId === entry.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                          <div className="flex items-end justify-between">
                            <div className="flex gap-4">
                              <div className="space-y-0.5">
                                <p className="text-[9px] font-black uppercase text-[color:var(--chart-1)]">P</p>
                                <p className="text-sm font-black">{entry.protein}g</p>
                              </div>
                              <div className="space-y-0.5">
                                <p className="text-[9px] font-black uppercase text-[color:var(--warning)]">C</p>
                                <p className="text-sm font-black">{entry.carbs}g</p>
                              </div>
                              <div className="space-y-0.5">
                                <p className="text-[9px] font-black uppercase text-[color:var(--info)]">F</p>
                                <p className="text-sm font-black">{entry.fat}g</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-black text-primary leading-none">{entry.calories}</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">kcal</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}