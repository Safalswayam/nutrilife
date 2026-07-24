"use client"

import React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { getApiUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"

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
  Camera,
  ImagePlus,
  X,
  Upload,
  SwitchCamera,
  Share2,
  Download,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SequenceLoader, SequenceLabel, DIET_PHASES } from "@/components/nl-loader"

interface MealPlan {
  meal: string        // Breakfast / Lunch
  dish: string        // Main dish name
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

// ─── Image compression utility ────────────────────────────────────────────────
// Smartphone photos can be 5–15 MB. This compresses them to a manageable size
// before upload / preview while preserving EXIF orientation via CSS.
async function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1600,
  quality = 0.82
): Promise<{ dataUrl: string; blob: Blob; originalSize: number; compressedSize: number }> {
  return new Promise((resolve, reject) => {
    const originalSize = file.size
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        // Calculate new dimensions keeping aspect ratio
        let { width, height } = img
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext("2d")
        if (!ctx) { reject(new Error("Canvas not supported")); return }

        // White background for photos that may have transparency
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error("Compression failed")); return }
            const dataUrl = canvas.toDataURL("image/jpeg", quality)
            resolve({ dataUrl, blob, originalSize, compressedSize: blob.size })
          },
          "image/jpeg",
          quality
        )
      }
      img.onerror = () => reject(new Error("Image load failed"))
      img.src = e.target?.result as string
    }

    reader.onerror = () => reject(new Error("File read failed"))
    reader.readAsDataURL(file)
  })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Image upload sub-component ───────────────────────────────────────────────
interface BodyPhotoUploadProps {
  onImageReady: (dataUrl: string | null, blob: Blob | null) => void
  onAnalysisComplete?: (data: { height: number; weight: number }) => void
  gender?: string
}

function BodyPhotoUpload({ onImageReady, onAnalysisComplete, gender }: BodyPhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [sizeInfo, setSizeInfo] = useState<{ original: number; compressed: number } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // Two hidden inputs: one for gallery, one for camera
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    setUploadError(null)

    // Basic validation
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file (JPG, PNG, HEIC, etc.)")
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setUploadError("File is too large (max 50 MB). Please choose a smaller photo.")
      return
    }

    setIsCompressing(true)
    try {
      const { dataUrl, blob, originalSize, compressedSize } = await compressImage(file)
      setPreview(dataUrl)
      setSizeInfo({ original: originalSize, compressed: compressedSize })
      onImageReady(dataUrl, blob)
    } catch (err) {
      setUploadError("Could not process this image. Please try another photo.")
      onImageReady(null, null)
    } finally {
      setIsCompressing(false)
    }
  }, [onImageReady])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    // Reset input so the same file can be re-selected
    e.target.value = ""
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const handleRemove = () => {
    setPreview(null)
    setSizeInfo(null)
    setUploadError(null)
    onImageReady(null, null)
  }

  const handleAnalyze = async () => {
    if (!preview) return
    setIsAnalyzing(true)
    setUploadError(null)
    
    try {
      // Remove data:image/jpeg;base64, prefix
      const base64 = preview.split(",")[1]
      const response = await fetch(getApiUrl("/api/analyze-body"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64, gender: gender || "male" })
      })
      
      const data = await response.json()
      if (data.success && onAnalysisComplete) {
        onAnalysisComplete({ height: data.height, weight: data.weight })
      } else {
        setUploadError(data.detail || "Analysis failed")
      }
    } catch (err) {
      setUploadError("Network error during analysis")
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Hidden file inputs */}
      {/* Gallery / files picker — works on all devices */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        aria-label="Upload from gallery"
      />
      {/* Camera capture — on mobile opens the camera directly */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        aria-label="Take a photo"
      />

      {preview ? (
        /* ── Preview state ── */
        <div className="relative rounded-xl overflow-hidden border border-border bg-muted/30">
          {/* The image uses object-contain so portrait phone photos aren't cropped */}
          <img
            src={preview}
            alt="Body photo preview"
            className="w-full max-h-64 object-contain bg-black/5"
            style={{ imageOrientation: "from-image" }}   // respect EXIF orientation
          />

          {/* Top-right remove button */}
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
            aria-label="Remove photo"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Size info pill */}
          {sizeInfo && (
            <div className="absolute bottom-2 left-2 flex gap-1">
              <span className="text-xs bg-black/60 text-white rounded-full px-2 py-0.5">
                {formatBytes(sizeInfo.original)} → {formatBytes(sizeInfo.compressed)}
              </span>
            </div>
          )}

          {/* Change photo / Analyze buttons */}
          <div className="p-3 space-y-2 bg-muted/50">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-tighter h-10 shadow-lg shadow-primary/20"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing Blueprint...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Extract Physical Specs
                </>
              )}
            </Button>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 gap-2 text-[10px] font-bold"
                onClick={() => galleryInputRef.current?.click()}
                disabled={isAnalyzing}
              >
                <ImagePlus className="w-4 h-4" />
                Change
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 gap-2 text-[10px] font-bold"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isAnalyzing}
              >
                <SwitchCamera className="w-4 h-4" />
                Retake
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Upload state ── */
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "rounded-xl border-2 border-dashed transition-colors",
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 bg-muted/20"
          )}
        >
          {isCompressing ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Optimising photo…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-6 px-4 text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-7 h-7 text-primary" />
              </div>

              <div>
                <p className="font-medium text-foreground text-sm">Upload a body photo</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Optional — helps track visual progress. Supports all smartphone formats (HEIC, JPG, PNG).
                </p>
              </div>

              {/* Two prominent buttons: gallery + camera */}
              <div className="flex gap-2 w-full">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2 min-h-[44px]"   /* 44 px minimum touch target */
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <ImagePlus className="w-4 h-4" />
                  <span>Gallery</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2 min-h-[44px]"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="w-4 h-4" />
                  <span>Camera</span>
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                or drag &amp; drop a file here · max 50 MB
              </p>
            </div>
          )}
        </div>
      )}

      {uploadError && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          {uploadError}
        </p>
      )}
    </div>
  )
}

// ─── Colour helpers ────────────────────────────────────────────────────────────
const getBMIColor = (bmi: number) => {
  if (bmi < 18.5) return "text-[color:var(--info)]"
  if (bmi < 25) return "text-primary"
  if (bmi < 30) return "text-accent"
  return "text-destructive"
}

const getBMIBgColor = (bmi: number) => {
  if (bmi < 18.5) return "bg-[color:var(--info)]"
  if (bmi < 25) return "bg-primary/10"
  if (bmi < 30) return "bg-accent/10"
  return "bg-destructive/10"
}

const difficultyColor: Record<string, string> = {
  None: "bg-muted-foreground text-muted-foreground",
  Easy: "bg-primary/15 text-primary",
  Moderate: "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
  Hard: "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
  "Very Hard": "bg-destructive/15 text-destructive",
  Extreme: "bg-[color:var(--info)]/15 text-[color:var(--info)]",
}

// ─── Main page ────────────────────────────────────────────────────────────────
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
    healthIssues: [] as string[],
    extraHabits: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<DietPlanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Body photo state
  const [bodyPhotoDataUrl, setBodyPhotoDataUrl] = useState<string | null>(null)
  const [bodyPhotoBlob, setBodyPhotoBlob] = useState<Blob | null>(null)

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

    const loadProfile = async () => {
      if (!token) return
      try {
        const res = await fetch(getApiUrl("/api/profile"), {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.profile) {
            setFormData(prev => ({
              ...prev,
              gender: data.profile.gender || prev.gender,
              height: data.profile.height?.toString() || prev.height,
              weight: data.profile.weight?.toString() || prev.weight,
              age: data.profile.age?.toString() || prev.age,
              activityLevel: data.profile.activity_level || prev.activityLevel,
              metabolismType: data.profile.metabolism_type || prev.metabolismType,
              goal: data.profile.goal || prev.goal,
              healthIssues: data.profile.health_issues ? JSON.parse(data.profile.health_issues) : [],
              extraHabits: data.profile.extra_habits || "",
            }))
          }
        }
      } catch (err) {
        console.error("Failed to load profile for diet planner:", err)
      }
    }
    loadProfile()
  }, [token])

  // Update selected fasting plan details when selection changes
  useEffect(() => {
    if (formData.fastingPlan && fastingPlans.length > 0) {
      const plan = fastingPlans.find(p => p.id === formData.fastingPlan)
      setSelectedFastingPlan(plan || null)
    }
  }, [formData.fastingPlan, fastingPlans])

  const handleImageReady = useCallback((dataUrl: string | null, blob: Blob | null) => {
    setBodyPhotoDataUrl(dataUrl)
    setBodyPhotoBlob(blob)
  }, [])

  const saveDietPlan = async () => {
    if (!result || !token) return

    setIsSaving(true)
    try {
      // The body photo is used locally for preview and by /api/analyze-body to
      // estimate height/weight. It is deliberately not persisted with the plan:
      // there is no upload route, and diet_plans has no column for it, so the
      // previous upload attempt 404'd and the URL was discarded server-side.
      const response = await fetch(getApiUrl("/api/diet-plan/save"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          target_calories: result.targetCalories,
          macros: result.macros,
          weekly_plan: result.weeklyPlan,
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
          health_issues: formData.healthIssues,
          extra_habits: formData.extraHabits,
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
            {
              meal: "Breakfast",
              dish: day.breakfast.name,
              time: "7:00 AM",
              foods: day.breakfast.ingredients,
              calories: day.breakfast.calories,
              protein: day.breakfast.protein,
              carbs: day.breakfast.carbs,
              fat: day.breakfast.fat,
            },
            {
              meal: "Morning Snack",
              dish: day.morning_snack.name,
              time: "10:00 AM",
              foods: day.morning_snack.ingredients,
              calories: day.morning_snack.calories,
              protein: day.morning_snack.protein,
              carbs: day.morning_snack.carbs,
              fat: day.morning_snack.fat,
            },
            {
              meal: "Lunch",
              dish: day.lunch.name,
              time: "12:30 PM",
              foods: day.lunch.ingredients,
              calories: day.lunch.calories,
              protein: day.lunch.protein,
              carbs: day.lunch.carbs,
              fat: day.lunch.fat,
            },
            {
              meal: "Afternoon Snack",
              dish: day.afternoon_snack.name,
              time: "3:30 PM",
              foods: day.afternoon_snack.ingredients,
              calories: day.afternoon_snack.calories,
              protein: day.afternoon_snack.protein,
              carbs: day.afternoon_snack.carbs,
              fat: day.afternoon_snack.fat,
            },
            {
              meal: "Dinner",
              dish: day.dinner.name,
              time: "7:00 PM",
              foods: day.dinner.ingredients,
              calories: day.dinner.calories,
              protein: day.dinner.protein,
              carbs: day.dinner.carbs,
              fat: day.dinner.fat,
            },
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
      <div className="p-3 md:p-8 space-y-8 max-w-7xl mx-auto">
        <div className="reveal-3d">
          <PageHeader
            title="Your diet plan"
            subtitle="Meals built around your goals, your week, and the food you actually enjoy."
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Form Section */}
          <Card className="lg:col-span-1 border-none glass-card rounded-[2.5rem] reveal-3d">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-2xl font-black flex items-center gap-3">
                <Calculator className="w-6 h-6 text-primary" />
                Physical Blueprint
              </CardTitle>
              <CardDescription>
                Enter your details to calculate BMI and generate a personalized diet plan
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-2">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* ── BODY PHOTO UPLOAD ──────────────────────────────────── */}
                <div className="space-y-4 pb-6 border-b border-white/5">
                  <Label className="flex items-center gap-2 text-xs font-black uppercase text-muted-foreground tracking-widest ml-1">
                    <Camera className="w-4 h-4 text-primary" />
                    Visual Progress
                    <span className="text-[10px] font-bold opacity-40 ml-1">(Opt)</span>
                  </Label>
                  <BodyPhotoUpload 
                    onImageReady={handleImageReady} 
                    gender={formData.gender}
                    onAnalysisComplete={(data) => {
                      setFormData(prev => ({ 
                        ...prev, 
                        height: data.height.toString(), 
                        weight: data.weight.toString() 
                      }))
                    }}
                  />
                </div>

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
                    Metabolic Velocity
                  </Label>
                  <Select
                    value={formData.metabolismType}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, metabolismType: value }))}
                  >
                    <SelectTrigger id="metabolism">
                      <SelectValue placeholder="Select velocity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fast">Accelerated (Fast)</SelectItem>
                      <SelectItem value="normal">Standard (Normal)</SelectItem>
                      <SelectItem value="slow">Steady (Slow)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Strategic Goal */}
                <div className="space-y-2">
                  <Label htmlFor="goal" className="flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Primary Trajectory
                  </Label>
                  <Select
                    value={formData.goal}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, goal: value }))}
                  >
                    <SelectTrigger id="goal">
                      <SelectValue placeholder="Select primary objective" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lose">Mass Reduction</SelectItem>
                      <SelectItem value="lose_fast">Mass Reduction (Aggressive)</SelectItem>
                      <SelectItem value="maintain">Homeostasis (Maintain)</SelectItem>
                      <SelectItem value="gain">Mass Augmentation</SelectItem>
                      <SelectItem value="gain_muscle">Structural Augmentation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Health Conditions */}
                <div className="space-y-3 pt-4 border-t border-white/5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Systemic Conditions</Label>
                  <div className="flex flex-wrap gap-2">
                    {["Diabetes", "Hypertension", "PCOS", "Thyroid"].map(issue => (
                      <Badge
                        key={issue}
                        variant={formData.healthIssues.includes(issue) ? "default" : "outline"}
                        className={cn(
                          "cursor-pointer px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all",
                          formData.healthIssues.includes(issue) ? "bg-primary shadow-lg shadow-primary/20" : "opacity-40 hover:opacity-100"
                        )}
                        onClick={() => {
                          const updated = formData.healthIssues.includes(issue)
                            ? formData.healthIssues.filter(i => i !== issue)
                            : [...formData.healthIssues, issue];
                          setFormData({ ...formData, healthIssues: updated });
                        }}
                      >
                        {issue}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Extra Habits */}
                <div className="space-y-2 pt-2">
                  <Label htmlFor="habits" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Architectural Habits</Label>
                  <Input
                    id="habits"
                    placeholder="e.g. Vegan, No Sugar, Fasting..."
                    value={formData.extraHabits}
                    onChange={(e) => setFormData({ ...formData, extraHabits: e.target.value })}
                    className="h-10 rounded-xl bg-white/5 border-white/5 font-bold text-xs"
                  />
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
                      <SelectItem value="non_veg">Non-Vegetarian</SelectItem>
                      <SelectItem value="veg">Vegetarian</SelectItem>
                      <SelectItem value="vegan">Vegan</SelectItem>
                      <SelectItem value="jain">Jain</SelectItem>
                      <SelectItem value="indian_non_veg">Indian Non-Veg (No Beef)</SelectItem>
                      <SelectItem value="halal">Halal / Muslim (No Pork)</SelectItem>
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
                    <Moon className="w-4 h-4 text-[color:var(--info)]" />
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
                            {plan.name}
                            {plan.fast_hours > 0 && (
                              <span className="text-muted-foreground ml-1 text-xs">
                                ({plan.fast_hours}h fast)
                              </span>
                            )}
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="none">No Fasting</SelectItem>
                          <SelectItem value="12:12">12:12 Beginner (12h fast)</SelectItem>
                          <SelectItem value="14:10">14:10 Beginner+ (14h fast)</SelectItem>
                          <SelectItem value="16:8">16:8 Leangains (16h fast)</SelectItem>
                          <SelectItem value="18:6">18:6 Advanced (18h fast)</SelectItem>
                          <SelectItem value="20:4">20:4 Warrior Diet (20h fast)</SelectItem>
                          <SelectItem value="omad">OMAD (23h fast)</SelectItem>
                          <SelectItem value="5:2">5:2 Diet (2 low-cal days/week)</SelectItem>
                          <SelectItem value="alternate">Alternate Day Fasting</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>

                  {/* Fasting plan details card */}
                  {selectedFastingPlan && selectedFastingPlan.id !== "none" && (
                    <div className="rounded-lg border border-[color:var(--info)] bg-[color:var(--info)] dark:bg-[color:var(--info)]/30 dark:border-[color:var(--info)] p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-[color:var(--info)] dark:text-[color:var(--info)]">
                          {selectedFastingPlan.emoji} {selectedFastingPlan.name}
                        </span>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          difficultyColor[selectedFastingPlan.difficulty] || "bg-muted-foreground text-muted-foreground"
                        )}>
                          {selectedFastingPlan.difficulty}
                        </span>
                      </div>
                      <p className="text-xs text-[color:var(--info)] dark:text-[color:var(--info)]">{selectedFastingPlan.description}</p>
                      {selectedFastingPlan.fast_hours > 0 && (
                        <div className="flex items-center gap-2 text-xs text-[color:var(--info)] dark:text-[color:var(--info)]">
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
                        <ul className="text-xs space-y-1 text-[color:var(--info)] dark:text-[color:var(--info)]">
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

                <div className="pt-4">
                  {error && (
                    <Alert variant="destructive" className="mb-4 rounded-2xl border-none bg-destructive/10 text-destructive">
                      <AlertTriangle className="w-4 h-4" />
                      <AlertDescription className="font-bold">{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    disabled={!isFormValid || isLoading}
                    className="w-full h-16 rounded-[1.5rem] text-xl font-black group shadow-3xl shadow-primary/20"
                  >
                    {isLoading ? (
                      <SequenceLabel phases={DIET_PHASES} />
                    ) : (
                      <>
                        <Sparkles className="w-6 h-6 mr-3 group-hover:rotate-12 transition-transform" />
                        Build my plan
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Results Section */}
          <div className="lg:col-span-2 space-y-8 reveal-3d">
            {result ? (
              <>
                {/* Fasting protocol badge (if active) */}
                {formData.fastingPlan !== "none" && selectedFastingPlan && (
                  <Alert className="bg-[color:var(--info)]/10 border-[color:var(--info)]/20 rounded-[1.5rem] border-none reveal-3d">
                    <Moon className="w-4 h-4 text-[color:var(--info)]" />
                    <AlertTitle className="text-[color:var(--info)] font-black uppercase text-[10px] tracking-widest">
                      Fasting Protocol Synchronized
                    </AlertTitle>
                    <AlertDescription className="text-[color:var(--info)] font-medium text-xs mt-1">
                      Your meals have been condensed to fit your {selectedFastingPlan.fast_hours > 0
                        ? `${selectedFastingPlan.fast_hours}-hour fasting window`
                        : "fasting schedule"}.
                    </AlertDescription>
                  </Alert>
                )}

                {/* BMI and Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 reveal-3d">
                  <Card className={cn("border-none glass-card rounded-3xl relative overflow-hidden group hover:scale-[1.02] transition-transform", getBMIBgColor(result.bmi))}>
                    <CardContent className="p-6">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2 opacity-60">Physical Index</p>
                      <p className={cn("text-4xl font-black mb-1", getBMIColor(result.bmi))}>{result.bmi}</p>
                      <p className={cn("text-xs font-black uppercase tracking-widest", getBMIColor(result.bmi))}>{result.bmiCategory}</p>
                    </CardContent>
                  </Card>

                  <Card className="border-none glass-card rounded-3xl hover:scale-[1.02] transition-transform">
                    <CardContent className="p-6 text-center">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2 opacity-60">Basal Metabolic Rate</p>
                      <p className="text-4xl font-black text-foreground mb-1">{result.bmr}</p>
                      <p className="text-xs font-bold text-muted-foreground uppercase opacity-40">kcal/day</p>
                    </CardContent>
                  </Card>

                  <Card className="border-none glass-card rounded-3xl hover:scale-[1.02] transition-transform">
                    <CardContent className="p-6 text-center">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2 opacity-60">Total Daily Expenditure</p>
                      <p className="text-4xl font-black text-foreground mb-1">{result.tdee}</p>
                      <p className="text-xs font-bold text-muted-foreground uppercase opacity-40">kcal/day</p>
                    </CardContent>
                  </Card>

                  <Card className="border-none bg-primary text-primary-foreground rounded-3xl shadow-3xl shadow-primary/20 hover:scale-[1.02] transition-transform">
                    <CardContent className="p-6 text-center">
                      <p className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-2">Architect's Target</p>
                      <p className="text-4xl font-black mb-1">{result.targetCalories}</p>
                      <p className="text-xs font-bold uppercase opacity-60">kcal/day</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Body photo result card (shown only when a photo was uploaded) */}
                {bodyPhotoDataUrl && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Camera className="w-5 h-5 text-primary" />
                        Starting Body Photo
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-xl overflow-hidden border border-border max-w-xs mx-auto">
                        <img
                          src={bodyPhotoDataUrl}
                          alt="Starting body photo"
                          className="w-full object-contain bg-black/5"
                          style={{ imageOrientation: "from-image", maxHeight: "320px" }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        Saved with your plan for progress tracking
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Macros */}
                <Card className="border-none glass-card rounded-[2.5rem] reveal-3d overflow-hidden">
                  <CardHeader className="p-8 pb-4">
                    <CardTitle className="text-xl font-black flex items-center gap-3">
                      <Flame className="w-5 h-5 text-primary" />
                      Macronutrient Targets
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 pt-0">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-6 rounded-3xl bg-destructive/10 border border-destructive/5 group hover:bg-destructive/20 transition-colors">
                        <p className="text-3xl font-black text-destructive">{result.macros.protein}g</p>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Protein</p>
                      </div>
                      <div className="text-center p-6 rounded-3xl bg-[color:var(--warning)]/10 border border-[color:var(--warning)]/5 group hover:bg-[color:var(--warning)]/20 transition-colors">
                        <p className="text-3xl font-black text-[color:var(--warning)]">{result.macros.carbs}g</p>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Carbs</p>
                      </div>
                      <div className="text-center p-6 rounded-3xl bg-[color:var(--info)]/10 border border-[color:var(--info)]/5 group hover:bg-[color:var(--info)]/20 transition-colors">
                        <p className="text-3xl font-black text-[color:var(--info)]">{result.macros.fat}g</p>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Fat</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Warnings */}
                {result.warnings && result.warnings.length > 0 && (
                  <Alert variant="destructive" className="border-none bg-destructive/10 text-destructive rounded-[1.5rem] reveal-3d">
                    <AlertTriangle className="w-5 h-5" />
                    <AlertTitle className="font-black uppercase tracking-widest text-[10px]">Medical Advisory</AlertTitle>
                    <AlertDescription className="mt-2 space-y-1 font-medium text-xs">
                      {result.warnings.map((w, i) => <p key={i}>• {w}</p>)}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Weekly Meal Plan */}
                <Card className="border-none glass-card rounded-[2.5rem] reveal-3d overflow-hidden">
                  <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-xl font-black flex items-center gap-3">
                      <Utensils className="w-5 h-5 text-primary" />
                      7-Day Nutritional Protocol
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => window.print()} className="rounded-xl border-white/10 glass-card">
                        <Download className="w-4 h-4 mr-2" /> Export
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8 pt-0 space-y-4">
                    {result.weeklyPlan.map((day, idx) => (
                      <div key={day.day} className="glass-card rounded-[1.5rem] overflow-hidden border-white/5 reveal-3d" style={{ animationDelay: `${idx * 50}ms` }}>
                        <button
                          onClick={() => setExpandedDay(expandedDay === day.day ? null : day.day)}
                          className="w-full flex items-center justify-between p-6 hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center font-black text-primary text-xl">
                              {day.day.charAt(0)}
                            </div>
                            <div className="text-left">
                              <p className="font-black text-lg">{day.day}</p>
                              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{day.meals.length} distinct scheduled meals</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-xl font-black text-foreground">{day.totalCalories}</p>
                              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Target kcal</p>
                            </div>
                            {expandedDay === day.day ? (
                              <ChevronUp className="w-5 h-5 text-primary" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        </button>

                        {expandedDay === day.day && (
                          <div className="border-t border-white/5 p-6 space-y-6 bg-white/5 animate-in slide-in-from-top-2 duration-300">
                            {day.meals.map((meal, mealIndex) => (
                              <div key={mealIndex} className="glass-card p-6 rounded-3xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                  <Utensils className="w-12 h-12" />
                                </div>
                                <div className="flex items-start justify-between mb-4">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <Clock className="w-3.5 h-3.5 text-primary" />
                                      <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{meal.time}</span>
                                    </div>
                                    <h4 className="text-xl font-black text-foreground">{meal.meal}</h4>
                                    <p className="text-sm font-bold text-primary mt-1">{meal.dish}</p>
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  <ul className="grid grid-cols-2 gap-x-6 gap-y-2">
                                    {meal.foods.map((food, foodIndex) => (
                                      <li key={foodIndex} className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary/50"></div>
                                        {food}
                                      </li>
                                    ))}
                                  </ul>
                                  <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
                                    <span className="px-3 py-1 text-[10px] font-black uppercase rounded-lg bg-destructive/10 text-destructive border border-destructive/10">{meal.protein}g P</span>
                                    <span className="px-3 py-1 text-[10px] font-black uppercase rounded-lg bg-[color:var(--warning)]/10 text-[color:var(--warning)] border border-[color:var(--warning)]/10">{meal.carbs}g C</span>
                                    <span className="px-3 py-1 text-[10px] font-black uppercase rounded-lg bg-[color:var(--info)]/10 text-[color:var(--info)] border border-[color:var(--info)]/10">{meal.fat}g F</span>
                                    <span className="px-3 py-1 text-[10px] font-black uppercase rounded-lg bg-primary/10 text-primary border border-primary/10 ml-auto">{meal.calories} kcal</span>
                                  </div>
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
                <Card className="border-none glass-card rounded-[2.5rem] reveal-3d overflow-hidden">
                  <CardHeader className="p-8 pb-4">
                    <CardTitle className="text-xl font-black flex items-center gap-3">
                      <Lightbulb className="w-5 h-5 text-[color:var(--warning)]" />
                      Strategic Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 pt-0">
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {result.tips.map((tip, index) => (
                        <li key={index} className="flex items-start gap-4 p-5 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                          <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-sm font-medium text-muted-foreground leading-relaxed">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </>
            ) : isLoading ? (
              <SequenceLoader
                phases={DIET_PHASES}
                label="Building your plan"
                className="min-h-[500px] content-center"
              />
            ) : (
              <Card className="flex items-center justify-center min-h-[500px] border-none glass-card rounded-[3rem]">
                <CardContent className="text-center py-12 space-y-6">
                  <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <Calculator className="w-9 h-9 text-primary" />
                  </div>
                  <h3 className="text-2xl font-semibold tracking-[-0.03em]">Your plan starts here</h3>
                  <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Tell us about your goals and your week on the left. We&apos;ll build meals around
                    the food you actually enjoy — and you can swap any of them later.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Diet Plan Integration */}
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
                <span className="block mt-1 text-[color:var(--info)] font-medium">
                  Your {selectedFastingPlan.name} fasting protocol will also be saved.
                </span>
              )}
              {bodyPhotoDataUrl && (
                <span className="block mt-1 text-primary font-medium">
                  Your body photo will be saved for progress tracking.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {saveSuccess ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle className="w-12 h-12 text-primary" />
              <p className="text-primary font-medium">Diet Plan Saved Successfully!</p>
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