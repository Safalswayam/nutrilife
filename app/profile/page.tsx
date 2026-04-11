"use client"

import { useState, useEffect, useRef } from "react"
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
  Save,
  CheckCircle,
  Target,
  Loader2,
  Camera,
  Trash2,
  Upload,
  LogOut,
  FileText,
  LifeBuoy,
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
  profile_image?: string | null
}

export default function ProfilePage() {
  const { user, token, refreshUser, logout } = useAuth()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"profile" | "goals">("profile")

  // Image upload state
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [removingImage, setRemovingImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [imageSaved, setImageSaved] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

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
        headers: { "Authorization": `Bearer ${token}` },
      })
      if (!response.ok) throw new Error("Failed to fetch profile")
      const data = await response.json()
      if (data.success) {
        setProfile({
          name:            data.profile.name            || "",
          email:           data.profile.email           || "",
          gender:          data.profile.gender          || "male",
          age:             data.profile.age             || "",
          height:          data.profile.height          || "",
          weight:          data.profile.weight          || "",
          activity_level:  data.profile.activity_level  || "moderate",
          metabolism_type: data.profile.metabolism_type || "normal",
          goal:            data.profile.goal            || "maintain",
          profile_image:   data.profile.profile_image   || null,
        })
        setImagePreview(data.profile.profile_image || null)
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
          name:            profile.name,
          gender:          profile.gender,
          age:             profile.age    ? parseInt(profile.age.toString())    : null,
          height:          profile.height ? parseFloat(profile.height.toString()) : null,
          weight:          profile.weight ? parseFloat(profile.weight.toString()) : null,
          activity_level:  profile.activity_level,
          metabolism_type: profile.metabolism_type,
          goal:            profile.goal,
        }),
      })
      if (!response.ok) throw new Error("Failed to update profile")
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

  // ── Image handlers ────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageError(null)

    if (!file.type.startsWith("image/")) {
      setImageError("Please select an image file (JPG, PNG, GIF, or WebP)")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError("Image must be under 5 MB")
      return
    }

    // Instant local preview
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    uploadImage(file)

    // Reset so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const uploadImage = async (file: File) => {
    if (!token) return
    setUploadingImage(true)
    setImageError(null)

    try {
      const form = new FormData()
      form.append("file", file)

      const res = await fetch(getApiUrl("/api/profile/image"), {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: form,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Upload failed")

      // Use server-canonical copy
      setImagePreview(data.profile_image)
      setProfile(prev => prev ? { ...prev, profile_image: data.profile_image } : prev)
      setImageSaved(true)
      setTimeout(() => setImageSaved(false), 3000)
      // Refresh auth context so sidebar avatar updates immediately
      await refreshUser()
    } catch (err: any) {
      setImageError(err.message || "Upload failed. Please try again.")
      setImagePreview(profile?.profile_image || null)
    } finally {
      setUploadingImage(false)
    }
  }

  const handleRemoveImage = async () => {
    if (!token) return
    setRemovingImage(true)
    setImageError(null)

    try {
      const res = await fetch(getApiUrl("/api/profile/image"), {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Failed to remove image")

      setImagePreview(null)
      setProfile(prev => prev ? { ...prev, profile_image: null } : prev)
      await refreshUser()
    } catch (err: any) {
      setImageError(err.message || "Failed to remove image")
    } finally {
      setRemovingImage(false)
    }
  }

  const tabs = [
    { id: "profile" as const, label: "Profile",      icon: User   },
    { id: "goals"   as const, label: "Health Goals", icon: Target },
  ]

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      router.replace("/login")
    } finally {
      setLoggingOut(false)
    }
  }

  const initials = profile?.name
    ? profile.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "U"

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
        <PageHeader title="Profile & Settings" subtitle="Manage your personal information and health goals" />
        <div className="text-center text-muted-foreground">{error || "Unable to load profile data"}</div>
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

        {/* ── Left Sidebar ── */}
        <div className="space-y-6">

          {/* Profile photo card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">

                {/* Avatar with camera hover overlay */}
                <div className="relative mb-3 group">
                  <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-border bg-primary/10 flex items-center justify-center select-none">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Profile photo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-primary">{initials}</span>
                    )}
                  </div>

                  {/* Hover overlay — click to open picker */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage || removingImage}
                    title="Change photo"
                    className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                  >
                    {uploadingImage
                      ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                      : <Camera className="w-6 h-6 text-white" />
                    }
                  </button>

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>

                {/* Upload / Remove buttons */}
                <div className="flex gap-2 mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage || removingImage}
                    className="text-xs h-7 px-2.5"
                  >
                    {uploadingImage
                      ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      : <Upload className="w-3 h-3 mr-1" />
                    }
                    {uploadingImage ? "Uploading…" : "Upload"}
                  </Button>

                  {imagePreview && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveImage}
                      disabled={uploadingImage || removingImage}
                      className="text-xs h-7 px-2.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {removingImage
                        ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        : <Trash2 className="w-3 h-3 mr-1" />
                      }
                      {removingImage ? "Removing…" : "Remove"}
                    </Button>
                  )}
                </div>

                {/* Feedback messages */}
                {imageSaved && (
                  <p className="text-xs text-green-600 flex items-center gap-1 mb-1">
                    <CheckCircle className="w-3 h-3" /> Photo saved
                  </p>
                )}
                {imageError && (
                  <p className="text-xs text-destructive mb-1 max-w-[160px] leading-snug text-center">
                    {imageError}
                  </p>
                )}

                <p className="text-[10px] text-muted-foreground mb-3">
                  JPG, PNG, GIF or WebP · Max 5 MB
                </p>

                <h3 className="text-lg font-semibold text-foreground">{profile.name || "User"}</h3>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
              </div>
            </CardContent>
          </Card>

          {/* Tab navigation */}
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

          {/* Achievements */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { emoji: "🍽️", label: "First Meal Logged", done: true },
                  { emoji: "📋", label: "Diet Plan Created", done: !!profile?.goal && profile.goal !== "maintain" },
                  { emoji: "🌙", label: "First Fast Completed", done: false },
                  { emoji: "💧", label: "Water Goal Hit", done: false },
                  { emoji: "📸", label: "Profile Photo Added", done: !!profile?.profile_image },
                  { emoji: "⭐", label: "7-Day Streak", done: false },
                ].map((badge) => (
                  <div key={badge.label} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${badge.done ? "bg-primary/10" : "bg-muted opacity-50"}`}>
                      {badge.emoji}
                    </div>
                    <span className={`text-sm ${badge.done ? "font-medium text-foreground" : "text-muted-foreground line-through"}`}>
                      {badge.label}
                    </span>
                    {badge.done && <CheckCircle className="w-3.5 h-3.5 text-primary ml-auto" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Account</CardTitle>
              <CardDescription>Use this button anytime you want to sign out.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Logging out...</>
                  : <><LogOut className="w-4 h-4 mr-2" />Log out</>}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── Main Content ── */}
        <div className="lg:col-span-3">
          {saved && (
            <Alert className="mb-6 bg-primary/10 border-primary/20">
              <CheckCircle className="w-4 h-4 text-primary" />
              <AlertDescription className="text-foreground">Profile updated successfully!</AlertDescription>
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
                <CardDescription>Update your personal details and physical measurements</CardDescription>
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
                    <Input id="email" value={profile.email} disabled className="bg-muted" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select value={profile.gender} onValueChange={(v) => setProfile({ ...profile, gender: v })}>
                      <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
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
                      id="age" type="number"
                      value={profile.age}
                      onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                      placeholder="28"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="height">Height (cm)</Label>
                    <Input
                      id="height" type="number"
                      value={profile.height}
                      onChange={(e) => setProfile({ ...profile, height: e.target.value })}
                      placeholder="175"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight (kg)</Label>
                    <Input
                      id="weight" type="number" step="0.1"
                      value={profile.weight}
                      onChange={(e) => setProfile({ ...profile, weight: e.target.value })}
                      placeholder="72"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="activity">Activity Level</Label>
                    <Select value={profile.activity_level} onValueChange={(v) => setProfile({ ...profile, activity_level: v })}>
                      <SelectTrigger><SelectValue placeholder="Select activity level" /></SelectTrigger>
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
                    <Select value={profile.metabolism_type} onValueChange={(v) => setProfile({ ...profile, metabolism_type: v })}>
                      <SelectTrigger><SelectValue placeholder="Select metabolism" /></SelectTrigger>
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
                    {saving
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                      : <><Save className="w-4 h-4 mr-2" />Save Changes</>
                    }
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
                <CardDescription>Define your health and fitness objectives</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="goal">Primary Goal</Label>
                  <Select value={profile.goal} onValueChange={(v) => setProfile({ ...profile, goal: v })}>
                    <SelectTrigger><SelectValue placeholder="Select your goal" /></SelectTrigger>
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
                    {saving
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                      : <><Save className="w-4 h-4 mr-2" />Save Changes</>
                    }
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Legal & Support Footer */}
        <div className="mt-8 border-t border-border pt-6">
          <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Legal & Support</p>
          <div className="flex flex-wrap gap-3">
            <a href="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Terms & Conditions
            </a>
            <span className="text-border">·</span>
            <a href="/support" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5">
              <LifeBuoy className="w-3.5 h-3.5" /> Support & Telegram
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            NutriLife · Built by Safal Swayam · KIIT University
          </p>
        </div>
      </div>
    </div>
  )
}
