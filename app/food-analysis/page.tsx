"use client"

import React from "react"
import { useState, useRef, useEffect } from "react"
import { getApiUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { PremiumGate } from "@/components/premium-gate"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge as UIBadge } from "@/components/ui/badge"
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
   Sparkles,
   Zap,
   Target,
   Search,
   ArrowRight,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { SequenceLoader, SequenceLabel, ANALYZER_PHASES } from "@/components/nl-loader"
import { Label } from "recharts"

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

   const [mealType, setMealType] = useState("meal")
   const [isLogging, setIsLogging] = useState(false)
   const [loggedSuccess, setLoggedSuccess] = useState(false)
   const [logError, setLogError] = useState<string | null>(null)

   useEffect(() => {
      if (!user || !token) {
         router.push("/login")
      }
   }, [user, token, router])

   useEffect(() => {
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

         const items = data.items || []
         const totalNutrition = data.nutrition || {}

         const transformedResult: AnalysisResult = {
            success: data.success,
            foods: items.map((item: { name: string; portion: string; calories: number }, idx: number) => {
               const totalCal = totalNutrition.calories || 1
               const share = item.calories / totalCal
               return {
                  food: item.name && item.name.toLowerCase() !== "default"
                     ? item.name
                     : (data.food_name || "Analyzed Food"),
                  calories: item.calories,
                  protein: Math.round((totalNutrition.protein ?? 0) * share * 10) / 10,
                  carbs: Math.round((totalNutrition.carbs ?? 0) * share * 10) / 10,
                  fat: Math.round((totalNutrition.fat ?? 0) * share * 10) / 10,
                  fiber: Math.round((totalNutrition.fiber ?? 0) * share * 10) / 10,
                  servingSize: item.portion,
                  healthBenefits: data.health_benefits || [],
                  warnings: data.warnings || [],
                  confidence: 0.85,
               }
            }),
            totalNutrition: {
               calories: totalNutrition.calories ?? 0,
               protein: totalNutrition.protein ?? 0,
               carbs: totalNutrition.carbs ?? 0,
               fat: totalNutrition.fat ?? 0,
               fiber: totalNutrition.fiber ?? 0,
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
            errorMsg = "Backend server is not running."
         } else if (err instanceof Error) {
            errorMsg = err.message
         }
         setError(errorMsg)
      } finally {
         setIsAnalyzing(false)
      }
   }

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
         <div className="p-3 md:p-8 space-y-8 max-w-7xl mx-auto">
            <div className="reveal-3d">
               <PageHeader
                  title="Food analyser"
                  subtitle="Photograph a meal and see what it actually means for your day."
               />
            </div>

            {/* Global Banner */}
            <div className="reveal-3d">
               <div className="glass-card p-4 rounded-3xl bg-[color:var(--info)]/10 border-[color:var(--info)]/20 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-[color:var(--info)]/20 flex items-center justify-center shrink-0">
                     <Zap className="w-5 h-5 text-[color:var(--info)]" />
                  </div>
                  <p className="text-sm font-medium text-[color:var(--info)] dark:text-[color:var(--info)]">
                     <span className="font-black">Pro Tip:</span> Analysis only calculates macros. Click <span className="font-bold underline">Log to Diary</span> below to save the results to your dailies.
                  </p>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
               {/* LEFT: Upload & Input */}
               <div className="space-y-8 reveal-3d">
                  <Card className="border-none glass-card rounded-[2.5rem] overflow-hidden">
                     <CardHeader className="p-8 pb-4">
                        <CardTitle className="text-2xl font-black flex items-center gap-3">
                           <Camera className="w-6 h-6 text-primary" /> Visual Capture
                        </CardTitle>
                     </CardHeader>
                     <CardContent className="p-8 pt-2 space-y-8">
                        {/* Visual Interface */}
                        <div className="relative group">
                           <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-[color:var(--info)]/20 rounded-[2.2rem] blur opacity-60 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                           <div className="relative">
                              {showWebcam ? (
                                 <div className="relative rounded-[2rem] overflow-hidden bg-black aspect-video shadow-2xl">
                                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                    <canvas ref={canvasRef} className="hidden" />
                                    <div className="absolute top-4 right-4 flex gap-2">
                                       <Button onClick={switchCamera} size="icon" variant="secondary" className="rounded-full glass-card border-none hover:bg-white/20">
                                          <RefreshCw className="w-5 h-5 text-white" />
                                       </Button>
                                       <Button onClick={closeWebcam} size="icon" variant="destructive" className="rounded-full shadow-lg">
                                          <X className="w-5 h-5" />
                                       </Button>
                                    </div>
                                    <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                                       <Button onClick={capturePhoto} size="lg" className="h-16 px-10 bg-primary hover:bg-primary/90 text-xl font-black rounded-3xl shadow-3xl shadow-primary/40 group/cam">
                                          <Camera className="w-6 h-6 mr-3 group-hover/cam:scale-110 transition-transform" />
                                          Snap Photo
                                       </Button>
                                    </div>
                                 </div>
                              ) : imagePreview ? (
                                 <div className="relative rounded-[2rem] overflow-hidden aspect-video shadow-2xl ring-1 ring-white/10">
                                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                    <button onClick={clearImage} className="absolute top-4 right-4 p-3 rounded-2xl bg-black/60 text-white backdrop-blur-md hover:bg-black transition-all">
                                       <X className="w-5 h-5" />
                                    </button>
                                 </div>
                              ) : (
                                 <div className="border-2 border-dashed border-white/10 rounded-[2rem] p-12 text-center bg-white/5 hover:bg-white/10 hover:border-primary/50 transition-all group/box">
                                    <div className="w-20 h-20 mx-auto rounded-3xl bg-primary/10 flex items-center justify-center mb-6 group-hover/box:scale-110 transition-transform">
                                       <ImageIcon className="w-10 h-10 text-primary opacity-60" />
                                    </div>
                                    <h4 className="text-xl font-black mb-2">Awaiting Visual Input</h4>
                                    <p className="text-muted-foreground font-medium mb-8 max-w-[240px] mx-auto text-sm">Upload a plate photo or use your camera for instant detection.</p>
                                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                       <Button onClick={triggerUpload} variant="outline" className="h-12 rounded-2xl border-white/10 glass-card px-6 font-bold">
                                          <Upload className="w-4 h-4 mr-2" /> Upload
                                       </Button>
                                       <Button onClick={() => startWebcam("environment")} className="h-12 rounded-2xl px-6 font-bold shadow-lg shadow-primary/20">
                                          <Camera className="w-4 h-4 mr-2" /> Start Camera
                                       </Button>
                                    </div>
                                    <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />
                                 </div>
                              )}
                           </div>
                        </div>

                        {/* Context Info */}
                        <div className="space-y-4">
                           <div className="flex items-center gap-2">
                              <Search className="w-4 h-4 text-primary" />
                              <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">Optional Context</Label>
                           </div>
                           <Textarea
                              placeholder="e.g. Scrambled eggs with a side of multigrain toast..."
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              className="rounded-2xl bg-white/5 border-none min-h-[100px] focus-visible:ring-primary/50 text-base"
                           />
                        </div>

                        {/* Analysis Trigger */}
                        <div className="pt-4">
                           {error && (
                              <Alert variant="destructive" className="mb-4 rounded-2xl border-none bg-destructive/10 text-destructive">
                                 <AlertTriangle className="w-4 h-4" />
                                 <AlertDescription className="font-bold">{error}</AlertDescription>
                              </Alert>
                           )}
                           <Button
                              onClick={analyzeFood}
                              disabled={isAnalyzing || (!image && !description.trim())}
                              className="w-full h-16 rounded-[1.5rem] text-xl font-black group shadow-3xl shadow-primary/20"
                           >
                              {!isAnalyzing && (
                                 <Sparkles className="w-6 h-6 mr-3 group-hover:rotate-12 transition-transform" />
                              )}
                              {isAnalyzing ? (
                                 <SequenceLabel phases={ANALYZER_PHASES} />
                              ) : (
                                 "Analyse this meal"
                              )}
                           </Button>
                        </div>

                        {/* Explicit Log to Diary Action (appears only after analysis) */}
                        {result && !loggedSuccess && (
                           <div className="glass-card p-6 rounded-[2rem] border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                              <h4 className="text-lg font-black flex items-center gap-2 mb-4">
                                 <BookOpen className="w-5 h-5 text-primary" /> Log results to diary?
                              </h4>
                              <div className="grid grid-cols-2 gap-4 mb-6">
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Meal Segment</label>
                                    <Select value={mealType} onValueChange={setMealType}>
                                       <SelectTrigger className="rounded-xl bg-white/5 border-none h-10"><SelectValue /></SelectTrigger>
                                       <SelectContent className="rounded-2xl glass-card">
                                          <SelectItem value="breakfast">Breakfast</SelectItem>
                                          <SelectItem value="lunch">Lunch</SelectItem>
                                          <SelectItem value="dinner">Dinner</SelectItem>
                                          <SelectItem value="snack">Snack</SelectItem>
                                       </SelectContent>
                                    </Select>
                                 </div>
                                 <div className="flex items-end">
                                    <Button onClick={logToDiary} disabled={isLogging} className="w-full h-10 rounded-xl font-bold bg-primary shadow-lg shadow-primary/20">
                                       {isLogging ? <Loader2 className="animate-spin" /> : "Log Now"}
                                    </Button>
                                 </div>
                              </div>
                              {logError && <p className="text-[10px] text-destructive font-bold ml-1">Error: {logError}</p>}
                           </div>
                        )}

                        {loggedSuccess && (
                           <div className="p-6 rounded-[2rem] bg-primary/10 flex items-center gap-4 border border-primary/20 animate-in zoom-in-95 duration-500">
                              <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                                 <CheckCircle className="w-6 h-6 text-primary" />
                              </div>
                              <div>
                                 <p className="font-black text-lg">Vital Saved Successfully!</p>
                                 <p className="text-sm text-muted-foreground font-medium">Results are now synced to your food diary.</p>
                              </div>
                           </div>
                        )}
                     </CardContent>
                  </Card>
               </div>

               {/* RIGHT: Results */}
               <div className="space-y-8 reveal-3d">
                  {result ? (
                     <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-700">
                        {/* Summary Bar */}
                        <Card className="border-none glass-card rounded-[2.5rem] bg-gradient-to-br from-primary/10 to-transparent">
                           <CardHeader className="p-8 pb-4">
                              <CardTitle className="text-xl font-black">Detected Nutrition Vitals</CardTitle>
                           </CardHeader>
                           <CardContent className="p-8 pt-0">
                              <div className="grid grid-cols-5 gap-2">
                                 {[
                                    { label: "kcal", value: result.totalNutrition.calories, icon: Flame, color: "text-primary" },
                                    { label: "Prot", value: result.totalNutrition.protein, icon: Apple, color: "text-destructive" },
                                    { label: "Carb", value: result.totalNutrition.carbs, icon: Target, color: "text-[color:var(--warning)]" },
                                    { label: "Fat", value: result.totalNutrition.fat, icon: Info, color: "text-[color:var(--info)]" },
                                    { label: "Fib", value: result.totalNutrition.fiber, icon: Sparkles, color: "text-primary" },
                                 ].map((stat, i) => (
                                    <div key={i} className="glass-card p-3 rounded-2xl flex flex-col items-center gap-1">
                                       <stat.icon className={cn("w-4 h-4", stat.color)} />
                                       <p className="text-lg font-black leading-none">{stat.value}</p>
                                       <p className="text-[9px] font-bold text-muted-foreground uppercase">{stat.label}</p>
                                    </div>
                                 ))}
                              </div>
                           </CardContent>
                        </Card>

                        {/* Detected Items List */}
                        <div className="space-y-4">
                           <h4 className="text-sm font-black text-muted-foreground uppercase tracking-widest px-4">Detected Ingredients</h4>
                           {result.foods.map((food, i) => (
                              <div key={i} className="glass-card p-6 rounded-[2rem] space-y-4 reveal-3d" style={{ animationDelay: `${i * 100}ms` }}>
                                 <div className="flex items-center justify-between">
                                    <h5 className="text-xl font-black capitalize">{food.food}</h5>
                                    <div className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black uppercase text-muted-foreground">{Math.round(food.confidence * 100)}% detection</div>
                                 </div>
                                 <div className="flex gap-4">
                                    <UIBadge variant="outline" className="border-primary/20 text-primary rounded-xl font-bold px-3 py-1">{food.servingSize}</UIBadge>
                                    <UIBadge variant="outline" className="border-[color:var(--info)]/20 text-[color:var(--info)] rounded-xl font-bold px-3 py-1">{food.calories} kcal</UIBadge>
                                 </div>
                                 <div className="flex gap-6 pt-2 border-t border-white/5">
                                    <div className="flex-1 space-y-1">
                                       <div className="flex justify-between text-[9px] font-black text-muted-foreground uppercase mb-1">
                                          <span>Macros share</span>
                                       </div>
                                       <div className="h-1.5 flex rounded-full overflow-hidden bg-white/5">
                                          <div className="bg-destructive h-full" style={{ width: `${(food.protein / (food.protein + food.carbs + food.fat + 0.1)) * 100}%` }}></div>
                                          <div className="bg-[color:var(--warning)] h-full" style={{ width: `${(food.carbs / (food.protein + food.carbs + food.fat + 0.1)) * 100}%` }}></div>
                                          <div className="bg-[color:var(--info)] h-full" style={{ width: `${(food.fat / (food.protein + food.carbs + food.fat + 0.1)) * 100}%` }}></div>
                                       </div>
                                    </div>
                                    <div className="flex gap-4 text-[11px] font-black">
                                       <span className="text-destructive">P: {food.protein}g</span>
                                       <span className="text-[color:var(--warning)]">C: {food.carbs}g</span>
                                       <span className="text-[color:var(--info)]">F: {food.fat}g</span>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>

                        {/* Recommendations and Warnings */}
                        <div className="grid md:grid-cols-2 gap-6 reveal-3d">
                           {result.healthBenefits.length > 0 && (
                              <div className="glass-card p-6 rounded-[2rem] border-primary/10">
                                 <h5 className="font-black text-primary flex items-center gap-2 mb-4">
                                    <CheckCircle className="w-5 h-5" /> Benefits
                                 </h5>
                                 <ul className="space-y-3">
                                    {result.healthBenefits.slice(0, 3).map((b, i) => (
                                       <li key={i} className="text-xs font-medium text-muted-foreground flex items-center gap-2 leading-tight">
                                          <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"></div>
                                          {b}
                                       </li>
                                    ))}
                                 </ul>
                              </div>
                           )}
                           {result.warnings.length > 0 && (
                              <div className="glass-card p-6 rounded-[2rem] border-[color:var(--warning)]/10">
                                 <h5 className="font-black text-[color:var(--warning)] flex items-center gap-2 mb-4">
                                    <AlertTriangle className="w-5 h-5" /> Insights
                                 </h5>
                                 <ul className="space-y-3">
                                    {result.warnings.slice(0, 3).map((w, i) => (
                                       <li key={i} className="text-xs font-medium text-muted-foreground flex items-center gap-2 leading-tight">
                                          <div className="w-1.5 h-1.5 rounded-full bg-[color:var(--warning)] shrink-0"></div>
                                          {w}
                                       </li>
                                    ))}
                                 </ul>
                              </div>
                           )}
                        </div>

                        <div className="glass-card p-6 rounded-[2rem] bg-gradient-to-r from-[color:var(--info)]/10 to-transparent border-[color:var(--info)]/10">
                           <p className="text-sm font-black text-[color:var(--info)] uppercase tracking-widest mb-2">Scientific Recommendation</p>
                           <p className="text-base font-bold italic leading-relaxed text-[color:var(--info)]/80 dark:text-[color:var(--info)]/80">"{result.recommendation}"</p>
                        </div>
                     </div>
                  ) : isAnalyzing ? (
                     <SequenceLoader
                        phases={ANALYZER_PHASES}
                        label="Analysing your meal"
                        className="min-h-[500px] content-center"
                     />
                  ) : (
                     <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 glass-card rounded-[3rem]">
                        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-7">
                           <Camera className="w-9 h-9 text-primary" />
                        </div>
                        <h3 className="text-2xl font-semibold tracking-[-0.03em] mb-2">Show us the plate</h3>
                        <p className="text-muted-foreground max-w-[300px] leading-relaxed">
                           Add a photo or describe the meal, and the full nutrition breakdown appears here.
                        </p>
                     </div>
                  )}
               </div>
            </div>
         </div>
      </PremiumGate>
   )
}