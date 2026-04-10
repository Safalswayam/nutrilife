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
  Beef, Wheat, Droplets, Utensils, Sun, Moon, Cookie
} from "lucide-react"
import { toast } from "sonner"

const QUICK_FOODS = [
  { name: "Rice (1 cup)",           calories: 206, protein: 4.3, carbs: 45,   fat: 0.4 },
  { name: "Dal (1 bowl)",           calories: 198, protein: 12,  carbs: 32,   fat: 3   },
  { name: "Roti (1 piece)",         calories: 104, protein: 3,   carbs: 20,   fat: 2   },
  { name: "Chicken Breast (100g)", calories: 165, protein: 31,  carbs: 0,    fat: 3.6 },
  { name: "Eggs (2 whole)",         calories: 155, protein: 13,  carbs: 1.1,  fat: 11  },
  { name: "Banana",                 calories: 105, protein: 1.3, carbs: 27,   fat: 0.4 },
  { name: "Apple",                  calories: 95,  protein: 0.5, carbs: 25,   fat: 0.3 },
  { name: "Milk (1 glass)",         calories: 149, protein: 8,   carbs: 12,   fat: 8   },
  { name: "Bread (2 slices)",       calories: 158, protein: 5.4, carbs: 30,   fat: 2   },
  { name: "Omelette (2 eggs)",      calories: 220, protein: 15,  carbs: 2,    fat: 17  },
  { name: "Salad (bowl)",           calories: 152, protein: 4,   carbs: 12,   fat: 10  },
  { name: "Biryani (1 plate)",      calories: 350, protein: 15,  carbs: 48,   fat: 12  },
  { name: "Butter Chicken",         calories: 380, protein: 28,  carbs: 12,   fat: 25  },
  { name: "Samosa (2 pcs)",         calories: 260, protein: 4,   carbs: 30,   fat: 14  },
  { name: "Idli (2 pcs)",           calories: 130, protein: 4,   carbs: 26,   fat: 0.5 },
  { name: "Dosa (1 plain)",         calories: 168, protein: 4,   carbs: 30,   fat: 4   },
  { name: "Upma (1 bowl)",          calories: 200, protein: 5,   carbs: 33,   fat: 6   },
  { name: "Poha (1 plate)",         calories: 250, protein: 4,   carbs: 46,   fat: 6   },
  { name: "Yogurt (1 cup)",         calories: 100, protein: 17,  carbs: 6,    fat: 0.7 },
  { name: "Coffee / Tea",           calories: 15,  protein: 0.5, carbs: 2,    fat: 0.5 },
]

const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast", icon: Sun  },
  { value: "lunch",     label: "Lunch",     icon: Utensils },
  { value: "dinner",    label: "Dinner",    icon: Moon },
  { value: "snack",     label: "Snack",     icon: Cookie },
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
  if (h >= 5  && h < 10) return "breakfast"
  if (h >= 10 && h < 12) return "snack"
  if (h >= 12 && h < 15) return "lunch"
  if (h >= 15 && h < 18) return "snack"
  if (h >= 18 && h < 22) return "dinner"
  return "snack"
}

export default function FoodLogPage() {
  const { token, user } = useAuth()

  const [foodName,    setFoodName]    = useState("")
  const [calories,    setCalories]    = useState("")
  const [protein,     setProtein]     = useState("")
  const [carbs,       setCarbs]       = useState("")
  const [fat,         setFat]         = useState("")
  const [mealType,    setMealType]    = useState(getMealTypeByHour)
  const [searchQuery, setSearchQuery] = useState("")
  const [submitting,  setSubmitting]  = useState(false)
  const [meals,       setMeals]       = useState<MealEntry[]>([])
  const [loadingMeals,setLoadingMeals]= useState(true)
  const [deletingId,  setDeletingId]  = useState<number | null>(null)

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
    if (!foodName.trim())            { toast.error("Please enter a food name"); return }
    if (!calories || +calories <= 0) { toast.error("Please enter calories");    return }
    if (!token)                      { toast.error("Please log in first");       return }

    setSubmitting(true)
    try {
      const params = new URLSearchParams({
        food_name: foodName.trim(),
        calories:  calories,
        protein:   protein || "0",
        carbs:     carbs   || "0",
        fat:       fat     || "0",
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
  const totalProtein  = meals.reduce((s, m) => s + (m.protein  || 0), 0)
  const totalCarbs    = meals.reduce((s, m) => s + (m.carbs    || 0), 0)
  const totalFat      = meals.reduce((s, m) => s + (m.fat      || 0), 0)
  const calorieGoal   = (user as any)?.target_calories || DEFAULT_GOAL
  const progressPct   = Math.min(100, Math.round((totalCalories / calorieGoal) * 100))
  const remaining     = calorieGoal - totalCalories

  const mealsByType = MEAL_TYPES.map(mt => ({
    ...mt,
    entries: meals.filter(m => m.meal_type === mt.value)
  }))

  const filteredQuick = searchQuery.trim()
    ? QUICK_FOODS.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : QUICK_FOODS

  return (
    <div className="p-3 md:p-8 max-w-6xl mx-auto">
      <PageHeader title="Food Log" subtitle="Track your daily food intake and calories" />

      {/* Live date banner */}
      <div className="flex items-center justify-between bg-muted/50 rounded-xl px-4 py-2 mb-2 mt-4 text-sm">
        <span className="text-muted-foreground font-medium">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        </span>
        <span className="text-primary font-semibold">
          {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
        </span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-2">

        {/* ── LEFT: Add food ── */}
        <div className="lg:col-span-1 space-y-4">

          {/* Quick search */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="w-4 h-4" /> Quick Add
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search foods..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-40 md:max-h-52 overflow-y-auto space-y-1 pr-1">
                {filteredQuick.map(food => (
                  <button
                    key={food.name}
                    onClick={() => handleQuickPick(food)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted text-left transition-colors"
                  >
                    <span className="text-sm font-medium truncate">{food.name}</span>
                    <Badge variant="secondary" className="ml-2 shrink-0 text-xs">{food.calories} kcal</Badge>
                  </button>
                ))}
                {filteredQuick.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No results — add manually below</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Manual entry */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <PlusCircle className="w-4 h-4" /> Manual Entry
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <Label htmlFor="food-name">Food Name *</Label>
                  <Input
                    id="food-name"
                    ref={nameInputRef}
                    placeholder="e.g. Grilled Paneer"
                    value={foodName}
                    onChange={e => setFoodName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="calories" className="flex items-center gap-1">
                      <Flame className="w-3 h-3 text-orange-500" /> Calories *
                    </Label>
                    <Input
                      id="calories" type="number" placeholder="kcal"
                      min="0" value={calories}
                      onChange={e => setCalories(e.target.value)} required
                    />
                  </div>
                  <div>
                    <Label>Meal Type</Label>
                    <Select value={mealType} onValueChange={setMealType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MEAL_TYPES.map(mt => (
                          <SelectItem key={mt.value} value={mt.value}>{mt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">Macros (optional)</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="flex items-center gap-1 text-xs">
                      <Beef className="w-3 h-3 text-red-400" /> Protein g
                    </Label>
                    <Input type="number" placeholder="0" min="0" step="0.1"
                      value={protein} onChange={e => setProtein(e.target.value)} />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1 text-xs">
                      <Wheat className="w-3 h-3 text-yellow-500" /> Carbs g
                    </Label>
                    <Input type="number" placeholder="0" min="0" step="0.1"
                      value={carbs} onChange={e => setCarbs(e.target.value)} />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1 text-xs">
                      <Droplets className="w-3 h-3 text-blue-400" /> Fat g
                    </Label>
                    <Input type="number" placeholder="0" min="0" step="0.1"
                      value={fat} onChange={e => setFat(e.target.value)} />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Logging...</>
                    : <><PlusCircle className="w-4 h-4 mr-2" />Log Food</>}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT: Summary + log ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Calorie summary */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-muted-foreground">Today's Calories</p>
                  <p className="text-3xl font-bold">
                    {totalCalories.toLocaleString()}
                    <span className="text-base font-normal text-muted-foreground"> / {calorieGoal.toLocaleString()} kcal</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Remaining</p>
                  <p className={`text-2xl font-bold ${remaining < 0 ? "text-red-500" : "text-green-600"}`}>
                    {remaining < 0 ? "+" : ""}{Math.abs(remaining).toLocaleString()}
                  </p>
                </div>
              </div>
              <Progress value={progressPct} className="h-3 mb-4" />
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-red-50 rounded-lg py-2">
                  <p className="text-xs text-muted-foreground">Protein</p>
                  <p className="font-bold text-red-600">{totalProtein.toFixed(1)}g</p>
                </div>
                <div className="bg-yellow-50 rounded-lg py-2">
                  <p className="text-xs text-muted-foreground">Carbs</p>
                  <p className="font-bold text-yellow-600">{totalCarbs.toFixed(1)}g</p>
                </div>
                <div className="bg-blue-50 rounded-lg py-2">
                  <p className="text-xs text-muted-foreground">Fat</p>
                  <p className="font-bold text-blue-600">{totalFat.toFixed(1)}g</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Meal groups */}
          {loadingMeals ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : meals.length === 0 ? (
            <Card>
              <CardContent className="text-center py-16">
                <Utensils className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-muted-foreground font-medium">No meals logged today</p>
                <p className="text-sm text-muted-foreground mt-1">Use the panel on the left to add your first entry</p>
              </CardContent>
            </Card>
          ) : (
            mealsByType.map(({ value, label, icon: Icon, entries }) => {
              if (entries.length === 0) return null
              const mealCals = entries.reduce((s, e) => s + (e.calories || 0), 0)
              return (
                <Card key={value}>
                  <CardHeader className="pb-2 pt-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Icon className="w-4 h-4 text-primary" /> {label}
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">
                        <Flame className="w-3 h-3 mr-1 text-orange-500" />{mealCals} kcal
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {entries.map(entry => (
                      <div key={entry.id}
                        className="flex items-center justify-between py-2 px-3 bg-muted/40 rounded-lg group">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{entry.food_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.calories} kcal
                            {entry.protein > 0 && ` · P ${entry.protein.toFixed(1)}g`}
                            {entry.carbs   > 0 && ` · C ${entry.carbs.toFixed(1)}g`}
                            {entry.fat     > 0 && ` · F ${entry.fat.toFixed(1)}g`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          disabled={deletingId === entry.id}
                          className="ml-2 p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          {deletingId === entry.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}