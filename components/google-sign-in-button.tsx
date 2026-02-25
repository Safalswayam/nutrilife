"use client"

import { useState } from "react"
import { GoogleLogin, CredentialResponse } from "@react-oauth/google"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface GoogleSignInProps {
  onSuccess?: () => void
  onError?: (error: string) => void
  redirectTo?: string
}

export function GoogleSignInButton({ 
  onSuccess, 
  onError,
  redirectTo = "/"
}: GoogleSignInProps) {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      toast.error("Google authentication failed")
      onError?.("No credential received")
      return
    }

    setIsProcessing(true)

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/api/auth/google`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            credential: credentialResponse.credential,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || "Google authentication failed")
      }

      // Store token
      localStorage.setItem("nutrilife_token", data.token)

      // Show success message
      if (data.is_new_user) {
        toast.success("Welcome to NutriLife! Account created successfully")
      } else {
        toast.success(`Welcome back, ${data.user.name}!`)
      }

      // Call success callback
      onSuccess?.()

      // Redirect
      router.push(redirectTo)
      window.location.reload() // Reload to update auth context

    } catch (error: any) {
      console.error("Google auth error:", error)
      toast.error(error.message || "Google authentication failed")
      onError?.(error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleGoogleError = () => {
    toast.error("Google authentication failed")
    onError?.("Google authentication failed")
  }

  if (isProcessing) {
    return (
      <div className="flex items-center justify-center p-3 border border-input rounded-md bg-background">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Signing in with Google...</span>
      </div>
    )
  }

  return (
    <div className="flex justify-center">
      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={handleGoogleError}
        useOneTap
        theme="outline"
        size="large"
        text="continue_with"
        shape="rectangular"
        logo_alignment="left"
      />
    </div>
  )
}

// Enhanced Auth Context with Google Login
export const enhancedAuthContextCode = `
// Add this to your existing auth-context.tsx

import { GoogleOAuthProvider } from '@react-oauth/google'

// Add to AuthContextType interface:
interface AuthContextType {
  // ... existing methods
  loginWithGoogle: (credential: string) => Promise<{ success: boolean; error?: string; is_new_user?: boolean }>
}

// Add to AuthProvider:
const loginWithGoogle = async (credential: string) => {
  try {
    const response = await fetch(\`\${API_URL}/api/auth/google\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.detail || "Google login failed" }
    }

    localStorage.setItem("nutrilife_token", data.token)
    setToken(data.token)
    setUser(data.user)

    return { 
      success: true, 
      is_new_user: data.is_new_user 
    }
  } catch (error) {
    return { 
      success: false, 
      error: "Network error. Please try again." 
    }
  }
}

// Add to value object:
const value = {
  // ... existing
  loginWithGoogle,
}

// Wrap your app with GoogleOAuthProvider in layout.tsx:
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  )
}
`

// Usage example in login page:
export const loginPageExample = `
import { GoogleSignInButton } from '@/components/google-sign-in-button'
import { Separator } from '@/components/ui/separator'

export default function LoginPage() {
  return (
    <div className="space-y-6">
      {/* Email/Password Login Form */}
      <form>
        {/* ... your existing form fields ... */}
      </form>

      <Separator />

      <div className="space-y-3">
        <p className="text-center text-sm text-muted-foreground">
          Or continue with
        </p>
        <GoogleSignInButton />
      </div>
    </div>
  )
}
`
