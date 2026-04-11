"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || ""

interface User {
  id: number
  email: string
  name: string
  gender?: string
  age?: number
  height?: number
  weight?: number
  activity_level?: string
  metabolism_type?: string
  goal?: string
  profile_image?: string | null
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  loginWithGoogle: (credential: string) => Promise<{ success: boolean; error?: string; is_new_user?: boolean }>
  register: (data: RegisterData) => Promise<{
    success: boolean
    error?: string
    message?: string
    requiresVerification?: boolean
    verificationEmail?: string
  }>
  verifyEmail: (email: string, code: string) => Promise<{ success: boolean; error?: string }>
  resendVerification: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>
  logout: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<{ success: boolean; error?: string }>
  refreshUser: () => Promise<void>
}

interface RegisterData {
  email: string
  password: string
  name: string
  gender?: string
  age?: number
  height?: number
  weight?: number
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("nutrilife_token")
    if (storedToken) {
      setToken(storedToken)
      fetchUser(storedToken)
    } else {
      setIsLoading(false)
    }
  }, [])

  const fetchUser = async (authToken: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        // Token is invalid
        localStorage.removeItem("nutrilife_token")
        setToken(null)
        setUser(null)
      }
    } catch (error) {
      console.error("Failed to fetch user:", error)
      localStorage.removeItem("nutrilife_token")
      setToken(null)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.detail || "Login failed" }
      }

      localStorage.setItem("nutrilife_token", data.token)
      setToken(data.token)
      setUser(data.user)

      return { success: true }
    } catch (error) {
      return { success: false, error: "Network error. Please try again." }
    }
  }

  const register = async (registerData: RegisterData) => {
    try {
      console.log("[v0] Sending register request to", `${API_URL}/api/auth/register`)
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerData),
      })

      console.log("[v0] Register response status:", response.status)
      const data = await response.json()
      console.log("[v0] Register response data:", data)

      if (!response.ok) {
        return { success: false, error: data.detail || "Registration failed" }
      }

      if (data.requires_verification) {
        return {
          success: true,
          message: data.message,
          requiresVerification: true,
          verificationEmail: data.verification_email,
        }
      }

      if (data.token) {
        localStorage.setItem("nutrilife_token", data.token)
        setToken(data.token)
        setUser(data.user)
      }

      return { success: true, message: data.message }
    } catch (error) {
      console.error("[v0] Register fetch error:", error)
      return { success: false, error: error instanceof Error ? error.message : "Network error. Please try again." }
    }
  }

  const verifyEmail = async (email: string, code: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.detail || "Email verification failed" }
      }

      localStorage.setItem("nutrilife_token", data.token)
      setToken(data.token)
      setUser(data.user)

      return { success: true }
    } catch (error) {
      return { success: false, error: "Network error. Please try again." }
    }
  }

  const resendVerification = async (email: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.detail || "Could not resend verification code" }
      }

      return { success: true, message: data.message }
    } catch (error) {
      return { success: false, error: "Network error. Please try again." }
    }
  }

  const loginWithGoogle = async (credential: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/google`, {
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

      return { success: true, is_new_user: data.is_new_user }
    } catch (error) {
      return { success: false, error: "Google login failed. Please try again." }
    }
  }

  const logout = async () => {
    try {
      if (token) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      }
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      localStorage.removeItem("nutrilife_token")
      setToken(null)
      setUser(null)
    }
  }

  const updateProfile = async (data: Partial<User>) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        return { success: false, error: result.detail || "Update failed" }
      }

      // Refresh user data
      if (token) {
        await fetchUser(token)
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: "Network error. Please try again." }
    }
  }

  const refreshUser = useCallback(async () => {
    if (token) {
      await fetchUser(token)
    }
  }, [token])

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    loginWithGoogle,
    register,
    verifyEmail,
    resendVerification,
    logout,
    updateProfile,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
