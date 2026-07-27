"use client"

import React, { useEffect } from "react"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { SidebarNav, MobileNav, MobileHeader } from "@/components/sidebar-nav"
import { FeedbackWidget } from "@/components/feedback-widget"
import { Loader2 } from "lucide-react"

const AUTH_PAGES = ["/login", "/signup", "/reset-password"]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isLoading, isAuthenticated } = useAuth()

  const isAuthPage = AUTH_PAGES.includes(pathname)
  const isLandingPage = pathname === "/"
  const skipNav = isAuthPage || isLandingPage

  // Signed-in visitors never belong on the marketing page. Redirecting here
  // rather than inside it is what lets the branch below skip mounting it.
  useEffect(() => {
    if (isLandingPage && !isLoading && isAuthenticated) router.replace("/dashboard")
  }, [isLandingPage, isLoading, isAuthenticated, router])

  // The landing owns its loading state — it has a cinematic intro, and the
  // generic spinner in front of it meant two loading screens in a row. But it
  // must not MOUNT before we know who the visitor is: an authenticated one is
  // about to be bounced to /dashboard, and mounting seven fixed stages plus
  // five multi-megabyte images first is wasted bandwidth and a visible flash
  // of marketing. Ink matches the intro's own first frame, so an anonymous
  // visitor sees no seam when the real page takes over.
  if (isLandingPage) {
    if (isLoading || isAuthenticated) return <div className="min-h-svh bg-nl-ink" />
    return <>{children}</>
  }

  if (isLoading && !isAuthPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/nutrilife-icon.png"
            alt="NutriLife"
            width={64}
            height={64}
            className="rounded-2xl animate-pulse"
          />
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading NutriLife...</span>
          </div>
        </div>
      </div>
    )
  }

  if (skipNav) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen bg-mesh bg-noise selection:bg-primary/20">
      {/* Desktop sidebar */}
      <SidebarNav />

      {/* Mobile top header */}
      <MobileHeader />

      {/* Main content */}
      <main className="flex-1 md:ml-64 pt-[56px] md:pt-0 pb-20 md:pb-0 min-w-0">
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <MobileNav />

      {/* Global Feedback Widget */}
      {!skipNav && <FeedbackWidget />}
    </div>
  )
}