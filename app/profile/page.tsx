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
  Activity,
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
  health_issues: string[]
  extra_habits: string
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
  const [activeTab, setActiveTab] = useState<"profile" | "goals" | "health">("profile")

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
          name: data.profile.name || "",
          email: data.profile.email || "",
          gender: data.profile.gender || "male",
          age: data.profile.age || "",
          height: data.profile.height || "",
          weight: data.profile.weight || "",
          activity_level: data.profile.activity_level || "moderate",
          metabolism_type: data.profile.metabolism_type || "normal",
          goal: data.profile.goal || "maintain",
          health_issues: data.profile.health_issues ? JSON.parse(data.profile.health_issues) : [],
          extra_habits: data.profile.extra_habits || "",
          profile_image: data.profile.profile_image || null,
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
          name: profile.name,
          gender: profile.gender,
          age: profile.age ? parseInt(profile.age.toString()) : null,
          height: profile.height ? parseFloat(profile.height.toString()) : null,
          weight: profile.weight ? parseFloat(profile.weight.toString()) : null,
          activity_level: profile.activity_level,
          metabolism_type: profile.metabolism_type,
          goal: profile.goal,
          health_issues: profile.health_issues,
          extra_habits: profile.extra_habits,
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
    { id: "goals" as const, label: "Health Goals", icon: Target },
    { id: "health" as const, label: "Analysis", icon: Activity },
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
    <div className="p-3 md:p-8">
      <div className="reveal-3d">
        <PageHeader
          title="Your details"
          subtitle="Architecting your physical blueprint and systemic performance parameters."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

        {/* ── Left Sidebar ── */}
        <div className="space-y-6">

          {/* Profile photo card */}
          <Card className="border-none glass-card rounded-[2.5rem] overflow-hidden reveal-3d">
            <CardContent className="p-8">
              <div className="flex flex-col items-center text-center">

                {/* Avatar with camera hover overlay */}
                <div className="relative mb-6 group">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/10 bg-white/5 flex items-center justify-center select-none shadow-3xl shadow-primary/20 transition-all duration-500 group-hover:scale-105 group-hover:border-primary/50">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Profile photo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl font-black text-primary">{initials}</span>
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
                  <p className="text-xs text-primary flex items-center gap-1 mb-1">
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

                <div className="space-y-1">
                  <h3 className="text-xl font-black uppercase tracking-tight text-foreground">{profile.name || "UNIDENTIFIED USER"}</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">{profile.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tab navigation */}
          <Card className="border-none glass-card rounded-[2rem] overflow-hidden reveal-3d">
            <CardContent className="p-2">
              <div className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-6 py-4 rounded-[1.5rem] transition-all group",
                        activeTab === tab.id
                          ? "bg-primary text-primary-foreground shadow-3xl shadow-primary/20"
                          : "text-foreground hover:bg-white/5 opacity-60 hover:opacity-100"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <Icon className={cn("w-5 h-5", activeTab === tab.id ? "animate-pulse" : "")} />
                        <span className="text-xs font-black uppercase tracking-widest">{tab.label}</span>
                      </div>
                      <div className={cn("w-1.5 h-1.5 rounded-full bg-white opacity-0 transition-all", activeTab === tab.id ? "opacity-100" : "group-hover:opacity-30")} />
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card className="border-none glass-card rounded-[2.5rem] overflow-hidden reveal-3d">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 opacity-60">
                <Target className="w-4 h-4 text-primary" />
                Evolution Badges
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { emoji: "🍽️", label: "First Sync", done: true },
                  { emoji: "📋", label: "Architect", done: !!profile?.goal && profile.goal !== "maintain" },
                  { emoji: "🌙", label: "Zephyr", done: false },
                  { emoji: "💧", label: "Hydra", done: false },
                  { emoji: "📸", label: "Vanguard", done: !!profile?.profile_image },
                  { emoji: "⭐", label: "Legend", done: false },
                ].map((badge) => (
                  <div key={badge.label} className={cn(
                    "relative flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all group",
                    badge.done ? "border-primary/20 bg-primary/5 shadow-inner" : "border-white/5 opacity-30 grayscale"
                  )}>
                    <div className="text-2xl group-hover:scale-110 transition-transform">{badge.emoji}</div>
                    <span className="text-[8px] font-black uppercase tracking-tight text-center leading-none">{badge.label}</span>
                    {badge.done && (
                      <div className="absolute -top-1 -right-1">
                        <CheckCircle className="w-3 h-3 text-primary fill-background" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Account */}
          <Card className="border-none glass-card rounded-[2rem] overflow-hidden reveal-3d">
            <CardContent className="p-6">
              <Button
                variant="destructive"
                className="w-full h-14 rounded-2xl text-xs font-black uppercase tracking-widest shadow-3xl shadow-destructive/20"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Terminating Session…</>
                  : <><LogOut className="w-4 h-4 mr-2" />Terminate Session</>}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── Main Content ── */}
        <div className="lg:col-span-3 space-y-8">
          {saved && (
            <Alert className="border-none glass-card bg-primary/10 text-primary rounded-2xl reveal-3d">
              <CheckCircle className="w-4 h-4" />
              <AlertDescription className="font-black uppercase text-xs tracking-widest">Profile divergence synchronized successfully.</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive" className="border-none glass-card bg-destructive/10 text-destructive rounded-2xl reveal-3d">
              <AlertDescription className="font-black uppercase text-xs tracking-widest">{error}</AlertDescription>
            </Alert>
          )}

          {activeTab === "profile" && (
            <Card className="border-none glass-card rounded-[2.5rem] overflow-hidden reveal-3d">
              <CardHeader className="p-8 pb-4">
                <CardTitle className="text-xl font-black uppercase tracking-widest flex items-center gap-3">
                  <User className="w-5 h-5 text-primary" />
                  Physical Blueprint
                </CardTitle>
                <CardDescription className="text-[10px] font-black uppercase tracking-widest opacity-40">Define your structural parameters for metabolic optimization.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {[
                    { id: "name", label: "Full Name", type: "text" },
                    { id: "email", label: "Primary Comms", type: "email", disabled: true },
                    { id: "age", label: "Biological Age", type: "number" },
                    { id: "height", label: "Vertical Scale (cm)", type: "number" },
                    { id: "weight", label: "Mass Index (kg)", type: "number" },
                  ].map(field => (
                    <div key={field.id} className="space-y-3">
                      <Label htmlFor={field.id} className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">{field.label}</Label>
                      <Input
                        id={field.id}
                        type={field.type}
                        disabled={field.disabled}
                        value={profile[field.id as keyof UserProfile] as string}
                        onChange={(e) => setProfile({ ...profile, [field.id]: e.target.value })}
                        className={cn("h-12 rounded-xl bg-white/5 border-white/5 focus:border-primary/50 transition-all font-bold", field.disabled && "opacity-50")}
                      />
                    </div>
                  ))}

                  <div className="space-y-3">
                    <Label htmlFor="gender" className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Gender Identification</Label>
                    <Select value={profile.gender} onValueChange={(v) => setProfile({ ...profile, gender: v })}>
                      <SelectTrigger className="h-12 rounded-xl bg-white/5 border-white/5 font-bold"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent className="glass-card border-white/10 rounded-xl">
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="activity" className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Kinetic Frequency</Label>
                    <Select value={profile.activity_level} onValueChange={(v) => setProfile({ ...profile, activity_level: v })}>
                      <SelectTrigger className="h-12 rounded-xl bg-white/5 border-white/5 font-bold"><SelectValue placeholder="Select activity" /></SelectTrigger>
                      <SelectContent className="glass-card border-white/10 rounded-xl">
                        <SelectItem value="sedentary">Sedentary (Minimum)</SelectItem>
                        <SelectItem value="light">Light (1-3 days)</SelectItem>
                        <SelectItem value="moderate">Moderate (3-5 days)</SelectItem>
                        <SelectItem value="active">Active (6-7 days)</SelectItem>
                        <SelectItem value="very_active">Very Active (Elite)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="metabolism" className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Metabolic Velocity</Label>
                    <Select value={profile.metabolism_type} onValueChange={(v) => setProfile({ ...profile, metabolism_type: v })}>
                      <SelectTrigger className="h-12 rounded-xl bg-white/5 border-white/5 font-bold"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent className="glass-card border-white/10 rounded-xl">
                        <SelectItem value="fast">Accelerated</SelectItem>
                        <SelectItem value="normal">Standard</SelectItem>
                        <SelectItem value="slow">Steady</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end border-t border-white/5 pt-8">
                  <Button onClick={handleSave} disabled={saving} className="h-14 px-10 rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-3xl shadow-primary/20">
                    {saving
                      ? <><Loader2 className="w-5 h-5 mr-3 animate-spin" />Syncing…</>
                      : <><Save className="w-5 h-5 mr-3" />Synchronize Physical Blueprint</>
                    }
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "goals" && (
            <Card className="border-none glass-card rounded-[2.5rem] overflow-hidden reveal-3d">
              <CardHeader className="p-8 pb-4">
                <CardTitle className="text-xl font-black uppercase tracking-widest flex items-center gap-3">
                  <Target className="w-5 h-5 text-primary" />
                  Strategic Objectives
                </CardTitle>
                <CardDescription className="text-[10px] font-black uppercase tracking-widest opacity-40">Define the terminal state for your physiological evolution.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-8">
                <div className="space-y-3">
                  <Label htmlFor="goal" className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Primary Trajectory</Label>
                  <Select value={profile.goal} onValueChange={(v) => setProfile({ ...profile, goal: v })}>
                    <SelectTrigger className="h-14 rounded-xl bg-white/5 border-white/5 font-bold text-lg"><SelectValue placeholder="Select objective" /></SelectTrigger>
                    <SelectContent className="glass-card border-white/10 rounded-xl">
                      <SelectItem value="lose">Mass Reduction (Standard)</SelectItem>
                      <SelectItem value="lose_fast">Mass Reduction (Aggressive)</SelectItem>
                      <SelectItem value="maintain">Homeostasis (Maintain)</SelectItem>
                      <SelectItem value="gain">Mass Augmentation (Standard)</SelectItem>
                      <SelectItem value="gain_muscle">Structural Augmentation (Hypertrophy)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-[2rem] bg-white/5 border border-white/5 p-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />
                  <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-4">Trajectory Analysis</h4>
                  <div className="space-y-4 text-sm font-medium">
                    {profile.goal === "lose" && (
                      <div className="space-y-1">
                        <p className="text-lg font-black text-[color:var(--info)]">Balanced Mass Reduction</p>
                        <p className="text-muted-foreground leading-relaxed">Targeting -0.5kg/week. Strategic deficit of 500 kcal optimized for sustainable fat oxidation while preserving lean tissue.</p>
                      </div>
                    )}
                    {profile.goal === "lose_fast" && (
                      <div className="space-y-1">
                        <p className="text-lg font-black text-destructive">Aggressive Mass Reduction</p>
                        <p className="text-muted-foreground leading-relaxed">Targeting -0.75kg/week. Deficit of 750 kcal. Requires high metabolic awareness and micronutrient precision.</p>
                      </div>
                    )}
                    {profile.goal === "maintain" && (
                      <div className="space-y-1">
                        <p className="text-lg font-black text-primary">Systemic Homeostasis</p>
                        <p className="text-muted-foreground leading-relaxed">Caloric equilibrium. Maintaining current structural mass with optimized nutrient timing and recovery protocols.</p>
                      </div>
                    )}
                    {profile.goal === "gain" && (
                      <div className="space-y-1">
                        <p className="text-lg font-black text-[color:var(--warning)]">Controlled Mass Augmentation</p>
                        <p className="text-muted-foreground leading-relaxed">Targeting +0.3kg/week. Surplus of 300 kcal to maximize mitochondrial density and systemic scale.</p>
                      </div>
                    )}
                    {profile.goal === "gain_muscle" && (
                      <div className="space-y-1">
                        <p className="text-lg font-black text-primary">Structural Hypertrophy</p>
                        <p className="text-muted-foreground leading-relaxed">Systemic surplus of 400 kcal. Optimized protein synthesis (1.8g/kg) and focused anabolic stimulation for maximum hypertrophy.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end border-t border-white/5 pt-8">
                  <Button onClick={handleSave} disabled={saving} className="h-14 px-10 rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-3xl shadow-primary/20">
                    {saving
                      ? <><Loader2 className="w-5 h-5 mr-3 animate-spin" />Syncing…</>
                      : <><Save className="w-5 h-5 mr-3" />Commit Trajectory</>
                    }
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "health" && (
            <Card className="border-none glass-card rounded-[2.5rem] overflow-hidden reveal-3d">
              <CardHeader className="p-8 pb-4">
                <CardTitle className="text-xl font-black uppercase tracking-widest flex items-center gap-3">
                  <Activity className="w-5 h-5 text-primary" />
                  Clinical Markers & Habits
                </CardTitle>
                <CardDescription className="text-[10px] font-black uppercase tracking-widest opacity-40">Architecting dietary logic for specific systemic conditions.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-10">
                <div className="space-y-6">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Systemic Conditions (Health Issues)</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      "Diabetes", "Hypertension", "PCOS", "Thyroid", "Cholesterol", "GERD/Acid Reflux"
                    ].map(issue => (
                      <button
                        key={issue}
                        type="button"
                        onClick={() => {
                          const current = profile.health_issues || [];
                          const updated = current.includes(issue)
                            ? current.filter(i => i !== issue)
                            : [...current, issue];
                          setProfile({ ...profile, health_issues: updated });
                        }}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                          profile.health_issues?.includes(issue)
                            ? "bg-primary/10 border-primary text-primary shadow-lg shadow-primary/5"
                            : "bg-white/5 border-white/5 text-muted-foreground opacity-60 hover:opacity-100"
                        )}
                      >
                        <span className="text-xs font-bold uppercase tracking-widest">{issue}</span>
                        {profile.health_issues?.includes(issue) && <CheckCircle className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <Label htmlFor="habits" className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Systemic Logic Prefaces (Extra Habits)</Label>
                  <textarea
                    id="habits"
                    value={profile.extra_habits}
                    onChange={(e) => setProfile({ ...profile, extra_habits: e.target.value })}
                    placeholder="e.g., Intermittent Fasting 16:8, High Protein, Only Black Coffee in Morning, No snacking after 8 PM..."
                    className="w-full min-h-[140px] rounded-2xl bg-white/5 border border-white/5 p-6 text-sm font-medium focus:border-primary/50 transition-all outline-none resize-none"
                  />
                  <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">These parameters will be woven into your generated diet plans by the AI strategist.</p>
                </div>

                <div className="flex justify-end border-t border-white/5 pt-8">
                  <Button onClick={handleSave} disabled={saving} className="h-14 px-10 rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-3xl shadow-primary/20">
                    {saving
                      ? <><Loader2 className="w-5 h-5 mr-3 animate-spin" />Syncing…</>
                      : <><Save className="w-5 h-5 mr-3" />Commit Systemic Logic</>
                    }
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Legal & Support Footer */}
        <div className="mt-16 border-t border-white/5 pt-12 flex flex-col md:flex-row items-center justify-between gap-8 reveal-3d">
          <div className="space-y-4 text-center md:text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">System Support & Framework</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-6">
              <a href="/terms" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-all flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> Protocols
              </a>
              <a href="/support" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-all flex items-center gap-2">
                <LifeBuoy className="w-3.5 h-3.5" /> Intelligence Network
              </a>
            </div>
          </div>
          <div className="text-center md:text-right space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Architectural Reference</p>
            <p className="text-xs font-black uppercase text-primary tracking-tighter">NutriLife Premium · KIIT University</p>
            <p className="text-[8px] font-bold text-muted-foreground/30 uppercase tracking-[0.2em]">Safal Swayam · Built for Human Optimization</p>
          </div>
        </div>
      </div>
    </div>
  )
}
