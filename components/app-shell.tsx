"use client"

import React from "react"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { SidebarNav, MobileNav, MobileHeader } from "@/components/sidebar-nav"
import { Loader2 } from "lucide-react"

const AUTH_PAGES = ["/login", "/signup"]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isLoading, isAuthenticated } = useAuth()

  const isAuthPage = AUTH_PAGES.includes(pathname)

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

  if (isAuthPage) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen bg-background">
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
    </div>
  )
}