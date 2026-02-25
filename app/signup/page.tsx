"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { getApiUrl } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
  User,
  Settings,
  Save,
  CheckCircle,
  Target,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

interface UserProfile {
  name: string
  email: string
  gender: string
  age: number | string
  height: number | string
  weight: number | string
  activity_level: string
  metabolism_type: string
  goal: string
}

export default function ProfilePage() {
  const { user, token } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"profile" | "goals">("profile")

  useEffect(() => {
    if (!user || !token) {
      router.push("/login")
      return
    }
    fetchProfile()
  }, [user, token])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const response = await fetch(getApiUrl("/api/profile"), {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch profile")
      }

      const data = await response.json()
      if (data.success) {
        setProfile({
          name: data.profile.name || "",
          email: data.profile.email || "",
          gender: data.profile.gender || "male",
          age: data.profile.age || "",
          height: data.profile.height || "",
          weight: data.profile.weight || "",
          activity_level: data.profile.activity_level || "moderate",
          metabolism_type: data.profile.metabolism_type || "normal",
          goal: data.profile.goal || "maintain",
        })
      }
    } catch (err) {
      console.error("Profile fetch error:", err)
      setError("Failed to load profile")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!profile || !token) return

    try {
      setSaving(true)
      setError(null)
      
      const response = await fetch(getApiUrl("/api/profile"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: profile.name,
          gender: profile.gender,
          age: profile.age ? parseInt(profile.age.toString()) : null,
          height: profile.height ? parseFloat(profile.height.toString()) : null,
          weight: profile.weight ? parseFloat(profile.weight.toString()) : null,
          activity_level: profile.activity_level,
          metabolism_type: profile.metabolism_type,
          goal: profile.goal,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update profile")
      }

      const data = await response.json()
      if (data.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (err) {
      console.error("Profile update error:", err)
      setError("Failed to save profile")
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "goals" as const, label: "Health Goals", icon: Target },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-4 md:p-8">
        <PageHeader
          title="Profile & Settings"
          subtitle="Manage your personal information and health goals"
        />
        <div className="text-center text-muted-foreground">
          {error || "Unable to load profile data"}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <PageHeader
        title="Profile & Settings"
        subtitle="Manage your personal information, health goals, and app preferences"
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Sidebar - Profile Card & Tabs */}
        <div className="space-y-6">
          {/* Profile Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <User className="w-12 h-12 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {profile.name || "User"}
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  {profile.email}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Tab Navigation */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left",
                        activeTab === tab.id
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{tab.label}</span>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {saved && (
            <Alert className="mb-6 bg-primary/10 border-primary/20">
              <CheckCircle className="w-4 h-4 text-primary" />
              <AlertDescription className="text-foreground">
                Profile updated successfully!
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {activeTab === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Personal Information
                </CardTitle>
                <CardDescription>
                  Update your personal details and physical measurements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={profile.email}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select value={profile.gender} onValueChange={(value) => setProfile({ ...profile, gender: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      value={profile.age}
                      onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                      placeholder="28"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="height">Height (cm)</Label>
                    <Input
                      id="height"
                      type="number"
                      value={profile.height}
                      onChange={(e) => setProfile({ ...profile, height: e.target.value })}
                      placeholder="175"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight (kg)</Label>
                    <Input
                      id="weight"
                      type="number"
                      step="0.1"
                      value={profile.weight}
                      onChange={(e) => setProfile({ ...profile, weight: e.target.value })}
                      placeholder="72"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="activity">Activity Level</Label>
                    <Select value={profile.activity_level} onValueChange={(value) => setProfile({ ...profile, activity_level: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select activity level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sedentary">Sedentary (Little/no exercise)</SelectItem>
                        <SelectItem value="light">Light (1-3 days/week)</SelectItem>
                        <SelectItem value="moderate">Moderate (3-5 days/week)</SelectItem>
                        <SelectItem value="active">Active (6-7 days/week)</SelectItem>
                        <SelectItem value="very_active">Very Active (Athlete)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="metabolism">Metabolism Type</Label>
                    <Select value={profile.metabolism_type} onValueChange={(value) => setProfile({ ...profile, metabolism_type: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select metabolism" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fast">Fast</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="slow">Slow</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSave} disabled={saving} size="lg">
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "goals" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Health Goals
                </CardTitle>
                <CardDescription>
                  Define your health and fitness objectives
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="goal">Primary Goal</Label>
                  <Select value={profile.goal} onValueChange={(value) => setProfile({ ...profile, goal: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your goal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lose">Lose Weight</SelectItem>
                      <SelectItem value="lose_fast">Lose Weight Fast</SelectItem>
                      <SelectItem value="maintain">Maintain Weight</SelectItem>
                      <SelectItem value="gain">Gain Weight</SelectItem>
                      <SelectItem value="gain_muscle">Gain Muscle</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    This will help us calculate your personalized calorie and macro targets
                  </p>
                </div>

                <div className="rounded-lg bg-muted/50 p-6">
                  <h4 className="font-semibold text-foreground mb-4">Goal Description</h4>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {profile.goal === "lose" && (
                      <div>
                        <p className="font-medium text-foreground">Moderate Weight Loss</p>
                        <p>Aim for 0.5kg per week with a balanced deficit of 500 calories per day.</p>
                      </div>
                    )}
                    {profile.goal === "lose_fast" && (
                      <div>
                        <p className="font-medium text-foreground">Rapid Weight Loss</p>
                        <p>Aim for 0.75kg per week with a deficit of 750 calories per day. Consult a professional.</p>
                      </div>
                    )}
                    {profile.goal === "maintain" && (
                      <div>
                        <p className="font-medium text-foreground">Maintain Weight</p>
                        <p>Keep your current weight by eating at maintenance calories.</p>
                      </div>
                    )}
                    {profile.goal === "gain" && (
                      <div>
                        <p className="font-medium text-foreground">Gain Weight</p>
                        <p>Aim for 0.25-0.5kg per week with a surplus of 300 calories per day.</p>
                      </div>
                    )}
                    {profile.goal === "gain_muscle" && (
                      <div>
                        <p className="font-medium text-foreground">Build Muscle</p>
                        <p>Gain lean muscle with 400 calorie surplus and high protein intake (30% of calories).</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSave} disabled={saving} size="lg">
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}