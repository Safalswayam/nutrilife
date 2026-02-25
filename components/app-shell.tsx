"use client"

import React from "react"

import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { SidebarNav, MobileNav } from "@/components/sidebar-nav"
import { Loader2, Leaf } from "lucide-react"

// Pages that don't require authentication and shouldn't show the sidebar
const AUTH_PAGES = ["/login", "/signup"]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isLoading, isAuthenticated } = useAuth()

  const isAuthPage = AUTH_PAGES.includes(pathname)

  // Show loading screen while checking auth status
  if (isLoading && !isAuthPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center animate-pulse">
            <Leaf className="h-9 w-9 text-primary-foreground" />
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading NutriLife...</span>
          </div>
        </div>
      </div>
    )
  }

  // Auth pages (login/signup) - no sidebar
  if (isAuthPage) {
    return <>{children}</>
  }

  // Main app layout with sidebar
  return (
    <div className="flex min-h-screen">
      <SidebarNav />
      <main className="flex-1 md:ml-64 pb-20 md:pb-0">{children}</main>
      <MobileNav />
    </div>
  )
}
