"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  ArrowRight,
  Shield,
  Apple,
  Heart,
  Loader2,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"

const normalizeGmail = (value: string) => {
  const normalized = value.trim().toLowerCase()

  if (normalized.endsWith("@googlemail.com")) {
    return `${normalized.slice(0, -15)}@gmail.com`
  }

  return normalized
}

const isValidGmail = (value: string) => /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(normalizeGmail(value))

const getPasswordError = (value: string) => {
  if (value.length < 8) return "Password must be at least 8 characters long"
  if (!/[A-Z]/.test(value)) return "Password must include at least one uppercase letter"
  if (!/[a-z]/.test(value)) return "Password must include at least one lowercase letter"
  if (!/\d/.test(value)) return "Password must include at least one number"
  return ""
}

export default function SignupPage() {
  const { register, verifyEmail, resendVerification } = useAuth()
  const router = useRouter()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [isVerificationStep, setIsVerificationStep] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const normalizedEmail = normalizeGmail(email)
    const passwordError = getPasswordError(password)

    if (!normalizedEmail || !password || !name.trim()) {
      setError("Please fill in all fields")
      return
    }

    if (!isValidGmail(normalizedEmail)) {
      setError("Direct sign up only accepts valid Gmail addresses.")
      return
    }

    if (passwordError) {
      setError(passwordError)
      return
    }

    try {
      setIsLoading(true)
      setError("")
      setMessage("")

      const result = await register({
        email: normalizedEmail,
        password,
        name: name.trim(),
      })

      if (!result.success) {
        setError(result.error || "Registration failed. Please try again.")
        return
      }

      if (result.requiresVerification) {
        const pendingEmail = result.verificationEmail || normalizedEmail
        setVerificationEmail(pendingEmail)
        setEmail(pendingEmail)
        setIsVerificationStep(true)
        setVerificationCode("")
        setMessage(result.message || `We sent a 6-digit code to ${pendingEmail}.`)
        return
      }

      router.push("/onboarding")
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (verificationCode.length !== 6) {
      setError("Enter the 6-digit verification code sent to your Gmail.")
      return
    }

    try {
      setIsLoading(true)
      setError("")
      setMessage("")

      const result = await verifyEmail(verificationEmail, verificationCode)

      if (!result.success) {
        setError(result.error || "Email verification failed.")
        return
      }

      router.push("/onboarding")
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    try {
      setIsResending(true)
      setError("")
      setMessage("")

      const result = await resendVerification(verificationEmail)

      if (!result.success) {
        setError(result.error || "Could not resend the verification code.")
        return
      }

      setVerificationCode("")
      setMessage(result.message || `A new verification code was sent to ${verificationEmail}.`)
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsResending(false)
    }
  }

  const handleUseDifferentEmail = () => {
    setIsVerificationStep(false)
    setVerificationCode("")
    setVerificationEmail("")
    setError("")
    setMessage("")
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-primary p-12 text-primary-foreground relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

        <div className="relative z-10 flex items-center gap-3 mb-12">
          <Image
            src="/nutrilife-icon.png"
            alt="NutriLife"
            width={48}
            height={48}
            priority
            className="rounded-xl shadow-lg ring-2 ring-white/20"
          />
          <div>
            <p className="text-2xl font-black tracking-tight text-white">NutriLife</p>
            <p className="text-[10px] text-white/70 tracking-widest uppercase font-bold">Track Your Health</p>
          </div>
        </div>

        <div className="relative z-10 max-w-md my-auto space-y-12">
          <div className="space-y-4">
            <h1 className="text-4xl lg:text-5xl font-black leading-tight text-white mb-6">
              Start your health journey today.
            </h1>
            <p className="text-lg text-white/80 text-pretty">
              Join thousands of users tracking their nutrition and achieving their goals with AI-powered guidance.
            </p>
          </div>

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
              <span>Personalized Health Goals</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-white/60 text-sm">
          <Shield className="h-4 w-4" />
          <span>Your data is completely private</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-16 bg-background">
        <div className="w-full max-w-md space-y-6 mx-auto">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <Image
              src="/nutrilife-icon.png"
              alt="NutriLife"
              width={48}
              height={48}
              priority
              className="rounded-xl shadow-md"
            />
            <div>
              <p className="text-2xl font-black text-foreground tracking-tight">NutriLife</p>
              <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold">Track Your Health</p>
            </div>
          </div>

          <Card className="border-0 shadow-xl">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-3xl font-bold">
                {isVerificationStep ? "Verify your Gmail" : "Create an account"}
              </CardTitle>
              <CardDescription>
                {isVerificationStep
                  ? `Enter the 6-digit code sent to ${verificationEmail}.`
                  : "Enter your details to get started"}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4 bg-destructive/10 border-destructive/20">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {message && (
                <Alert className="mb-4 border-primary/20 bg-primary/5">
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              )}

              {isVerificationStep ? (
                <form onSubmit={handleVerifySubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="verification-email">Gmail</Label>
                    <Input
                      id="verification-email"
                      type="email"
                      value={verificationEmail}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="verification-code">Verification Code</Label>
                    <div className="flex justify-center">
                      <InputOTP
                        id="verification-code"
                        maxLength={6}
                        value={verificationCode}
                        onChange={setVerificationCode}
                        autoFocus
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Only verified Gmail addresses can finish direct sign up.
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading || verificationCode.length !== 6}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify and Continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 bg-transparent"
                      onClick={handleResendCode}
                      disabled={isLoading || isResending}
                    >
                      {isResending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Resend Code"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="flex-1"
                      onClick={handleUseDifferentEmail}
                      disabled={isLoading || isResending}
                    >
                      Use Different Gmail
                    </Button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Gmail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="name@gmail.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                        autoComplete="email"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Direct sign up only works with real Gmail addresses that you can verify.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                        minLength={8}
                        autoComplete="new-password"
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
                    <p className="text-xs text-muted-foreground">
                      Use at least 8 characters with uppercase, lowercase, and a number.
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending verification code...
                      </>
                    ) : (
                      <>
                        Sign Up
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pt-0">
              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Already have an account?</span>
                </div>
              </div>

              <Link href="/login" className="w-full">
                <Button variant="outline" className="w-full bg-transparent">
                  Sign in instead
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            By creating an account, you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-4 hover:text-primary">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="underline underline-offset-4 hover:text-primary">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
