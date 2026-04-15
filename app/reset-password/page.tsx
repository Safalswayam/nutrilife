"use client"

import React, { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  Shield,
  CheckCircle2,
  AlertCircle
} from "lucide-react"

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [token, setToken] = useState("")
  const [email, setEmail] = useState("")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const t = searchParams.get("token")
    const e = searchParams.get("email")

    if (!t || !e) {
      setError("Invalid or missing reset token. Please request a new password reset link.")
    } else {
      setToken(t)
      setEmail(e)
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, new_password: password })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => {
          router.push("/login")
        }, 3000)
      } else {
        setError(data.detail || "Failed to reset password. The link might be expired.")
      }
    } catch (err) {
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="border-0 shadow-2xl animate-in fade-in zoom-in duration-300">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">Password Reset!</CardTitle>
          <CardDescription className="text-base text-balance">
            Your password has been updated successfully. You will be redirected to the login page in a few seconds.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href="/login" className="w-full">
            <Button className="w-full h-11">
              Go to Login
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-2xl overflow-hidden">
      <div className="h-2 bg-primary w-full" />
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-3xl font-bold">New Password</CardTitle>
        <CardDescription>
          Set a strong password to protect your account
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11"
                  required
                  disabled={!!error && !token}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 h-11"
                  required
                  disabled={!!error && !token}
                />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full h-11 mt-2" disabled={isLoading || (!!error && !token)}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating password...
              </>
            ) : (
              <>
                Reset Password
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex justify-center border-t bg-muted/30 py-4">
        <Link href="/login" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
          Back to login
        </Link>
      </CardFooter>
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-muted/40 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-primary/5 -skew-y-6 -translate-y-1/2" />
      <div className="absolute top-1/2 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl translate-y-1/2" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="flex flex-col items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group transition-transform hover:scale-105">
            <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
              <Image
                src="/nutrilife-icon.png"
                alt="NutriLife"
                width={32}
                height={32}
                priority
              />
            </div>
            <span className="text-2xl font-black tracking-tight text-foreground">NutriLife</span>
          </Link>
        </div>

        <Suspense fallback={
          <Card className="border-0 shadow-2xl">
            <CardHeader className="space-y-1 pb-4 text-center">
              <div className="mx-auto w-10 h-10 rounded-full flex items-center justify-center mb-4">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
              <CardTitle className="text-2xl font-bold">Loading...</CardTitle>
            </CardHeader>
          </Card>
        }>
          <ResetPasswordForm />
        </Suspense>

        <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs">
          <Shield className="h-3 w-3" />
          <span>Secure end-to-end encrypted password reset</span>
        </div>
      </div>
    </div>
  )
}
