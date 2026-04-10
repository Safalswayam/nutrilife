"use client"

import React from "react"

import { useState, useRef } from "react"
import { getApiUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { PremiumGate } from "@/components/premium-gate"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Camera,
  Upload,
  ImageIcon,
  Loader2,
  Flame,
  X,
  CheckCircle,
  AlertTriangle,
  Info,
  Apple,
  RefreshCw,
  BookOpen,
} from "lucide-react"
import { useRouter } from "next/navigation"

interface FoodResult {
  food: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  servingSize: string
  healthBenefits: string[]
  warnings: string[]
  confidence: number
}

interface AnalysisResult {
  success: boolean
  foods: FoodResult[]
  totalNutrition: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
  }
  healthBenefits: string[]
  warnings: string[]
  recommendation: string
  logged?: boolean
  _rawItems?: { name: string; calories: number; portion: string }[]
  _rawNutrition?: { protein: number; carbs: number; fat: number; fiber: number; calories: number }
}

export default function FoodAnalysisPage() {
  const { token, user } = useAuth()
  const router = useRouter()
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [description, setDescription] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showWebcam, setShowWebcam] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Logging state
  const [mealType, setMealType] = useState("meal")
  const [isLogging, setIsLogging] = useState(false)
  const [loggedSuccess, setLoggedSuccess] = useState(false)
  const [logError, setLogError] = useState<string | null>(null)

  React.useEffect(() => {
    if (!user || !token) {
      router.push("/login")
    }
  }, [user, token])

  React.useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      setError(null)
      setResult(null)
      setLoggedSuccess(false)
      setLogError(null)
    }
  }

  const startWebcam = async (facing: "user" | "environment" = "environment") => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing }
      })
      setStream(mediaStream)
      setShowWebcam(true)
      setFacingMode(facing)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (err) {
      console.error("Error accessing webcam:", err)
      setError("Could not access camera. Please check permissions.")
    }
  }

  const switchCamera = async () => {
    const newFacingMode = facingMode === "environment" ? "user" : "environment"
    await startWebcam(newFacingMode)
  }

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "webcam-photo.jpg", { type: "image/jpeg" })
            setImage(file)
            setImagePreview(canvas.toDataURL("image/jpeg"))
            closeWebcam()
            setError(null)
            setResult(null)
            setLoggedSuccess(false)
            setLogError(null)
          }
        }, "image/jpeg")
      }
    }
  }

  const closeWebcam = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setShowWebcam(false)
  }

  const triggerUpload = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const clearImage = () => {
    setImage(null)
    setImagePreview(null)
    setResult(null)
    setLoggedSuccess(false)
    setLogError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // ── ANALYZE ONLY (no auto-log) ───────────────────────────────────────────
  const analyzeFood = async () => {
    if (!image && !description.trim()) {
      setError("Please upload an image or describe the food")
      return
    }
    if (!token) {
      setError("Please login to analyze food")
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setLoggedSuccess(false)
    setLogError(null)

    try {
      let imageBase64 = null
      if (image) {
        const reader = new FileReader()
        imageBase64 = await new Promise((resolve) => {
          reader.onloadend = () => {
            const base64 = reader.result as string
            resolve(base64.split(",")[1])
          }
          reader.readAsDataURL(image)
        })
      }

      // Analyze-only endpoint — does NOT log automatically
      const response = await fetch(getApiUrl("/api/analyze-food"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          description: description || "food meal",
          image_base64: imageBase64,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || "Failed to analyze food")
      }

      // Distribute total nutrition evenly across detected items for per-item display
      const items = data.items || []
      const totalNutrition = data.nutrition || {}
      const itemCount = items.length || 1

      const transformedResult: AnalysisResult = {
        success: data.success,
        foods: items.map((item: { name: string; portion: string; calories: number }, idx: number) => {
          // Estimate per-item macros proportionally by calorie share
          const totalCal = totalNutrition.calories || 1
          const share = item.calories / totalCal
          return {
            food: item.name && item.name.toLowerCase() !== "default"
              ? item.name
              : (data.food_name || "Analyzed Food"),
            calories: item.calories,
            protein: Math.round((totalNutrition.protein ?? 0) * share * 10) / 10,
            carbs:   Math.round((totalNutrition.carbs   ?? 0) * share * 10) / 10,
            fat:     Math.round((totalNutrition.fat     ?? 0) * share * 10) / 10,
            fiber:   Math.round((totalNutrition.fiber   ?? 0) * share * 10) / 10,
            servingSize: item.portion,
            healthBenefits: data.health_benefits || [],
            warnings: data.warnings || [],
            confidence: 0.85,
          }
        }),
        totalNutrition: {
          calories: totalNutrition.calories ?? 0,
          protein:  totalNutrition.protein  ?? 0,
          carbs:    totalNutrition.carbs    ?? 0,
          fat:      totalNutrition.fat      ?? 0,
          fiber:    totalNutrition.fiber    ?? 0,
        },
        healthBenefits: data.health_benefits || [],
        warnings: data.warnings || [],
        recommendation:
          data.healthier_alternatives && data.healthier_alternatives.length > 0
            ? `Try these healthier alternatives: ${data.healthier_alternatives.join(", ")}`
            : "This looks like a balanced meal choice!",
        logged: false,
        _rawItems: items,
        _rawNutrition: totalNutrition,
      }

      setResult(transformedResult)
    } catch (err) {
      console.error("[v0] Food analysis error:", err)
      let errorMsg = "An error occurred"
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        errorMsg = "Backend server is not running. Please start it with: uvicorn api.index:app --reload"
      } else if (err instanceof Error) {
        errorMsg = err.message
      }
      setError(errorMsg)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // ── LOG TO DIARY (explicit user action) ──────────────────────────────────
  const logToDiary = async () => {
    if (!result || !token) return

    setIsLogging(true)
    setLogError(null)

    try {
      const response = await fetch(getApiUrl("/api/meals/log-batch"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: result._rawItems || [],
          nutrition: result._rawNutrition || {},
          meal_type: mealType,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || "Failed to log to diary")
      }

      setLoggedSuccess(true)
      setResult(prev => prev ? { ...prev, logged: true } : prev)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to log food"
      setLogError(msg)
    } finally {
      setIsLogging(false)
    }
  }

  return (
    <PremiumGate feature="food_analyzer">
      <div className="p-3 md:p-8">
        <PageHeader
          title="Food Analysis"
          subtitle="Upload or capture food photos to get instant calorie and nutrition information"
        />

        {/* Info Banner */}
        <Alert className="mb-6 bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
          <Info className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-blue-700 dark:text-blue-300">
            Analyzing food does <strong>not</strong> add it to your diary. After analyzing, use the{" "}
            <strong>Log to Food Diary</strong> button below to save it.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                Capture or Upload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Webcam View */}
              {showWebcam ? (
                <div className="relative rounded-xl overflow-hidden bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-64 object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  <Button
                    onClick={switchCamera}
                    size="icon"
                    variant="secondary"
                    className="absolute top-4 right-4 rounded-full"
                    title="Switch camera"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </Button>
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                    <Button onClick={capturePhoto} size="lg" className="bg-primary hover:bg-primary/90">
                      <Camera className="w-5 h-5 mr-2" />
                      Capture Photo
                    </Button>
                    <Button onClick={closeWebcam} size="lg" variant="secondary">
                      <X className="w-5 h-5 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : imagePreview ? (
                <div className="relative rounded-xl overflow-hidden">
                  <img
                    src={imagePreview || "/placeholder.svg"}
                    alt="Food preview"
                    className="w-full h-64 object-cover"
                  />
                  <button
                    onClick={clearImage}
                    className="absolute top-2 right-2 p-2 rounded-full bg-foreground/80 text-background hover:bg-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary transition-colors">
                  <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">Upload a photo of your food or take a picture</p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button type="button" variant="outline" onClick={triggerUpload}>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Image
                    </Button>
                    <Button type="button" variant="default" onClick={() => startWebcam("environment")}>
                      <Camera className="w-4 h-4 mr-2" />
                      Take Photo
                    </Button>
                  </div>
                </div>
              )}

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                aria-label="Upload food image"
              />

              {/* Food Description */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Describe the food (optional but helps accuracy)
                </label>
                <Textarea
                  placeholder="e.g., grilled chicken with rice and salad"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Error Message */}
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Analyze Button */}
              <Button
                onClick={analyzeFood}
                disabled={isAnalyzing || (!image && !description.trim())}
                className="w-full"
                size="lg"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Flame className="w-4 h-4 mr-2" />
                    Analyze Food
                  </>
                )}
              </Button>

              {/* ── LOG TO DIARY SECTION (appears after analysis, before logging) ── */}
              {result && !loggedSuccess && (
                <div className="border-2 border-dashed border-primary/40 rounded-xl p-4 space-y-3 bg-primary/5">
                  <p className="text-sm font-semibold text-primary flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Log this meal to your Food Diary
                  </p>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Meal Type</label>
                    <Select value={mealType} onValueChange={setMealType}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="breakfast">Breakfast</SelectItem>
                        <SelectItem value="lunch">Lunch</SelectItem>
                        <SelectItem value="dinner">Dinner</SelectItem>
                        <SelectItem value="snack">Snack</SelectItem>
                        <SelectItem value="meal">Other / General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {logError && (
                    <Alert variant="destructive" className="py-2">
                      <AlertTriangle className="w-3 h-3" />
                      <AlertDescription className="text-xs">{logError}</AlertDescription>
                    </Alert>
                  )}
                  <Button
                    onClick={logToDiary}
                    disabled={isLogging}
                    className="w-full"
                    variant="default"
                  >
                    {isLogging ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Logging...
                      </>
                    ) : (
                      <>
                        <BookOpen className="w-4 h-4 mr-2" />
                        Log to Food Diary
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Success Message after logging */}
              {loggedSuccess && (
                <Alert className="bg-primary/10 border-primary/20">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <AlertTitle className="text-primary">Logged Successfully!</AlertTitle>
                  <AlertDescription className="text-foreground">
                    This meal has been added to your food diary.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Results Section */}
          <div className="space-y-6">
            {result ? (
              <>
                {/* Total Nutrition */}
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Total Nutrition</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                      {[
                        { label: "Calories", value: result.totalNutrition.calories, unit: "kcal" },
                        { label: "Protein", value: result.totalNutrition.protein, unit: "g" },
                        { label: "Carbs", value: result.totalNutrition.carbs, unit: "g" },
                        { label: "Fat", value: result.totalNutrition.fat, unit: "g" },
                        { label: "Fiber", value: result.totalNutrition.fiber, unit: "g" },
                      ].map((item) => (
                        <div key={item.label} className="text-center p-3 rounded-lg bg-card">
                          <p className="text-2xl font-bold text-foreground">{item.value}</p>
                          <p className="text-xs text-muted-foreground">{item.unit}</p>
                          <p className="text-sm font-medium text-foreground">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Detected Foods */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Apple className="w-5 h-5 text-primary" />
                      Detected Foods
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {result.foods.map((food, index) => (
                        <div key={index} className="p-4 rounded-xl border border-border bg-muted/30">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-foreground">{food.food}</h4>
                            <span className="text-sm text-muted-foreground">
                              {Math.round(food.confidence * 100)}% confidence
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">Serving size: {food.servingSize}</p>
                          <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 text-xs rounded-full bg-chart-1/20 text-chart-1">{food.calories} kcal</span>
                            <span className="px-2 py-1 text-xs rounded-full bg-chart-2/20 text-chart-2">{food.protein}g protein</span>
                            <span className="px-2 py-1 text-xs rounded-full bg-chart-3/20 text-chart-3">{food.carbs}g carbs</span>
                            <span className="px-2 py-1 text-xs rounded-full bg-chart-4/20 text-chart-4">{food.fat}g fat</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Health Benefits */}
                {result.healthBenefits.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <CheckCircle className="w-5 h-5 text-primary" />
                        Health Benefits
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {result.healthBenefits.map((benefit, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-foreground">
                            <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Warnings */}
                {result.warnings.length > 0 && (
                  <Card className="border-accent/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <AlertTriangle className="w-5 h-5 text-accent" />
                        Things to Consider
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {result.warnings.map((warning, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-foreground">
                            <AlertTriangle className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Recommendation */}
                <Alert className="bg-primary/10 border-primary/20">
                  <Info className="w-4 h-4 text-primary" />
                  <AlertTitle className="text-primary">Recommendation</AlertTitle>
                  <AlertDescription className="text-foreground">{result.recommendation}</AlertDescription>
                </Alert>
              </>
            ) : (
              <Card className="h-full flex items-center justify-center min-h-[400px]">
                <CardContent className="text-center py-12">
                  <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                    <Camera className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Analysis Yet</h3>
                  <p className="text-muted-foreground max-w-xs mx-auto">
                    Upload or capture a food image and click analyze to see detailed nutrition information
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PremiumGate>
  )
}