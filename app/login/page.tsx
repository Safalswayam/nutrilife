"use client"

import React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { GoogleLogin } from "@react-oauth/google"
import {
  Leaf,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  Shield,
  Heart,
  Apple,
  Sparkles,
} from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const { login, loginWithGoogle, isAuthenticated } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  
  // Forgot password states
  const [isForgotOpen, setIsForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState("")
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotMessage, setForgotMessage] = useState("")
  
  // Redirect if already authenticated — must be in useEffect, not render
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard")
    }
  }, [isAuthenticated, router])

  if (isAuthenticated) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    console.log("[v0] Attempting login for:", email)

    const result = await login(email, password)
    console.log("[v0] Login result:", result)

    if (result.success) {
      router.push("/dashboard")
    } else {
      setError(result.error || "Login failed")
    }

    setIsLoading(false)
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail) return
    
    setForgotLoading(true)
    setForgotMessage("")
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail })
      })
      
      const data = await response.json()
      if (response.ok) {
        setForgotMessage(data.message || "Reset link sent!")
      } else {
        setForgotMessage("Failed to process request. Please try again.")
      }
    } catch (err) {
      setForgotMessage("Network error. Please try again.")
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-14 flex-col justify-center gap-12 relative overflow-hidden">
        
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-white/10" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-white/5" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-white/5" />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-5">
          <Image
            src="/nutrilife-icon.png"
            alt="NutriLife"
            width={140}
            height={140}
            priority
            className="rounded-3xl shadow-xl"
          />
          <div>
            <p className="text-5xl font-black text-white tracking-tight">NutriLife</p>
            <p className="text-sm text-white/70 tracking-[0.25em] uppercase mt-1">Track Your Health</p>
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10 space-y-10">
          <div>
            <h1 className="text-4xl font-bold text-white mb-4 text-balance">
              Your Journey to Better Health Starts Here
            </h1>
            <p className="text-lg text-white/80 text-pretty">
              Track your nutrition, get personalized diet plans, and receive AI-powered health guidance.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-white/90">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <Apple className="h-5 w-5" />
              </div>
              <span>AI-Powered Food Analysis</span>
            </div>

            <div className="flex items-center gap-3 text-white/90">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <Heart className="h-5 w-5" />
              </div>
              <span>Personalized Health Assistant</span>
            </div>

            <div className="flex items-center gap-3 text-white/90">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
              </div>
              <span>Custom Diet Plans Based on BMI</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center gap-2 text-white/60 text-sm">
          <Shield className="h-4 w-4" />
          <span>Your data is encrypted and secure</span>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-16 bg-background">
        <div className="w-full max-w-md space-y-6 mx-auto">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <Image
              src="/nutrilife-icon.png"
              alt="NutriLife"
              width={48}
              height={48}
              priority
              className="rounded-xl"
            />
            <div>
              <p className="text-2xl font-black text-foreground tracking-tight">NutriLife</p>
              <p className="text-[10px] text-muted-foreground tracking-widest uppercase">Track Your Health</p>
            </div>
          </div>

          <Card className="border-0 shadow-xl">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-3xl font-bold">Welcome back</CardTitle>
              <CardDescription>
                Enter your credentials to access your account
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">

                {error && (
                  <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsForgotOpen(true)}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-4"
                  >
                    Forgot password?
                  </button>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pt-0">

              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              {/* GOOGLE LOGIN */}
              <GoogleLogin
                onSuccess={async (credentialResponse) => {
                  try {
                    const result = await loginWithGoogle(credentialResponse.credential!)
                    if (result.success) {
                      if (result.is_new_user) {
                        router.push("/onboarding")
                      } else {
                        router.push("/dashboard")
                      }
                    } else {
                      setError(result.error || "Google login failed")
                    }
                  } catch (err) {
                    console.error("Google Login Error:", err)
                    setError("Google login failed")
                  }
                }}
                onError={() => {
                  console.error("Google Login Failed")
                  setError("Google login failed")
                }}
              />

              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">New to NutriLife?</span>
                </div>
              </div>

              <Link href="/signup" className="w-full">
                <Button variant="outline" className="w-full bg-transparent">
                  Create an account
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-4 hover:text-primary">
              Terms & Conditions
            </Link>{" "}
            and can get help from{" "}
            <Link href="/support" className="underline underline-offset-4 hover:text-primary">
              Support & Telegram
            </Link>
            .
          </p>

        </div>
      </div>
      
      {/* Forgot Password Modal */}
      {isForgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl border-border animate-in fade-in zoom-in-95 duration-200">
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
              <CardDescription>
                Enter your email address to receive a secure password reset link.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                {forgotMessage && (
                  <Alert className={forgotMessage.includes("sent") ? "bg-primary/10 border-primary/20 text-primary" : "bg-destructive/10 border-destructive/20 text-destructive"}>
                    <AlertDescription>{forgotMessage}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input 
                    id="forgot-email"
                    type="email" 
                    placeholder="name@example.com" 
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="ghost" onClick={() => { setIsForgotOpen(false); setForgotMessage(""); }}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={forgotLoading || !forgotEmail}>
                    {forgotLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Send Link
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
      
    </div>
  )
}
