"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { getApiUrl } from "@/lib/api"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Target,
  Activity,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Loader2,
  Sparkles,
  Flame,
  Weight
} from "lucide-react"

export default function OnboardingPage() {
  const { user, token } = useAuth()
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [formData, setFormData] = useState({
    goal: "lose",
    gender: "male",
    age: "",
    height: "",
    weight: "",
    activity_level: "light",
  })

  // Prevent seeing onboarding without being logged in
  useEffect(() => {
    if (!token) {
      router.push("/login")
    }
  }, [token, router])

  const handleNext = () => {
    if (step === 1) {
      setStep(2)
    } else if (step === 2) {
      // Validate inputs
      if (!formData.age || !formData.height || !formData.weight) {
        setError("Please fill in all physical measurements")
        return
      }
      setError("")
      setStep(3)
      saveProfile()
    }
  }

  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  const saveProfile = async () => {
    try {
      setLoading(true)
      const response = await fetch(getApiUrl("/api/auth/profile"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          age: parseInt(formData.age),
          height: parseFloat(formData.height),
          weight: parseFloat(formData.weight),
        })
      })

      if (!response.ok) {
        throw new Error("Failed to save profile")
      }

      // Simulate AI calculation time
      setTimeout(() => {
        setStep(4)
      }, 2000)

    } catch (err) {
      setError("Failed to save profile. Please try again.")
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  const finishOnboarding = () => {
    router.push("/dashboard") // Redirects to Dashboard
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">

      {/* Progress Dots */}
      {step < 4 && (
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${step === i ? "w-8 bg-primary" : step > i ? "w-2 bg-primary/40" : "w-2 bg-muted-foreground/20"
                }`}
            />
          ))}
        </div>
      )}

      <div className="w-full max-w-lg">
        {step === 1 && (
          <Card className="border-border shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="text-center space-y-4 pb-8 pt-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-3xl font-bold">What is your primary goal?</CardTitle>
              <CardDescription className="text-base">
                We'll customize your diet plans and calorie targets based on this.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { id: "lose", title: "Lose Weight", desc: "Burn fat and get leaner", icon: Flame },
                { id: "maintain", title: "Maintain Weight", desc: "Stay healthy and fit", icon: Activity },
                { id: "gain", title: "Gain Weight / Muscle", desc: "Build strength and mass", icon: Weight }
              ].map((goalOption) => (
                <div
                  key={goalOption.id}
                  onClick={() => setFormData({ ...formData, goal: goalOption.id })}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.goal === goalOption.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                >
                  <div className={`p-3 rounded-lg ${formData.goal === goalOption.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <goalOption.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-lg">{goalOption.title}</h3>
                    <p className="text-sm text-muted-foreground">{goalOption.desc}</p>
                  </div>
                  {formData.goal === goalOption.id && <CheckCircle className="w-6 h-6 text-primary ml-auto" />}
                </div>
              ))}
            </CardContent>
            <CardFooter className="pt-4 pb-8">
              <Button onClick={handleNext} className="w-full h-12 text-lg">
                Continue <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 2 && (
          <Card className="border-border shadow-xl animate-in fade-in slide-in-from-right-8 duration-500">
            <CardHeader className="pb-6 pt-8">
              <CardTitle className="text-2xl font-bold">Tell us about yourself</CardTitle>
              <CardDescription>
                We use these metrics to calculate your BMR and daily caloric needs precisely.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={formData.gender} onValueChange={(val) => setFormData({ ...formData, gender: val })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Age (years)</Label>
                  <Input
                    type="number"
                    placeholder="25"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Height (cm)</Label>
                  <Input
                    type="number"
                    placeholder="175"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weight (kg)</Label>
                  <Input
                    type="number"
                    placeholder="70"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Activity Level</Label>
                <Select value={formData.activity_level} onValueChange={(val) => setFormData({ ...formData, activity_level: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sedentary">Sedentary (office job, little exercise)</SelectItem>
                    <SelectItem value="light">Lightly Active (1-2 days/week)</SelectItem>
                    <SelectItem value="moderate">Moderately Active (3-5 days/week)</SelectItem>
                    <SelectItem value="very_active">Very Active (6-7 days/week)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </CardContent>
            <CardFooter className="flex gap-3 pb-8">
              <Button variant="outline" onClick={handleBack} className="h-12 px-6">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Button onClick={handleNext} className="h-12 flex-1 text-lg">
                Calculate My Plan <Sparkles className="w-5 h-5 ml-2" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 3 && (
          <Card className="border-border shadow-xl text-center py-16 animate-in fade-in duration-500">
            <CardContent className="flex flex-col items-center space-y-6">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-4 border-muted rounded-full"></div>
                <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                </div>
              </div>
              <div className="space-y-2 text-center">
                <h2 className="text-2xl font-bold">Personalizing Your Journey...</h2>
                <p className="text-muted-foreground">Calculating BMR, macros, and diet plans</p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card className="border-border shadow-xl text-center py-12 animate-in zoom-in-95 duration-500">
            <CardContent className="flex flex-col items-center space-y-6">
              <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold">You're All Set!</h2>
                <p className="text-muted-foreground text-lg px-4">
                  Welcome to NutriLife, {user?.name?.split(' ')[0] || 'User'}. Your personalized dashboard is ready.
                </p>
              </div>
              <Button onClick={finishOnboarding} className="h-12 px-8 text-lg mt-4 w-full sm:w-auto">
                Go to Dashboard <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  )
}
