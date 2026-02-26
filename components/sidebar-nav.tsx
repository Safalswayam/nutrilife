"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Home,
  Camera,
  MessageCircle,
  Calculator,
  User,
  LogOut,
  Settings,
  ChevronDown,
  LogIn,
  Crown,
  ClipboardList,
  Menu,
  X,
  Moon,
} from "lucide-react"

const navItems = [
  { title: "Dashboard",       href: "/",                icon: Home         },
  { title: "Food Log",        href: "/food-log",        icon: ClipboardList },
  { title: "Food Analysis",   href: "/food-analysis",   icon: Camera       },
  { title: "Health Assistant",href: "/health-assistant",icon: MessageCircle},
  { title: "Diet Planner",    href: "/diet-planner",    icon: Calculator   },
  { title: "Fasting Tracker", href: "/fasting-tracker", icon: Moon         },
  { title: "Subscription",    href: "/subscription",    icon: Crown        },
  { title: "Profile",         href: "/profile",         icon: User         },
]

// Bottom nav shows 5 most-used items
const bottomNavItems = [
  { title: "Home",     href: "/",                icon: Home          },
  { title: "Food Log", href: "/food-log",        icon: ClipboardList  },
  { title: "Camera",   href: "/food-analysis",   icon: Camera        },
  { title: "Diet",     href: "/diet-planner",    icon: Calculator    },
  { title: "Profile",  href: "/profile",         icon: User          },
]

export function SidebarNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  return (
    <aside className="hidden md:flex flex-col w-64 bg-sidebar text-sidebar-foreground min-h-screen fixed left-0 top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-sidebar-border">
        <Image
          src="/nutrilife-icon.png"
          alt="NutriLife"
          width={44}
          height={44}
          priority
          className="rounded-xl"
        />
        <div>
          <p className="text-base font-bold text-sidebar-foreground leading-tight">NutriLife</p>
          <p className="text-[10px] text-sidebar-foreground/60 tracking-widest uppercase">Track Your Health</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.title}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User section */}
      <div className="px-4 py-6 border-t border-sidebar-border">
        {isAuthenticated && user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 w-full px-4 py-3 rounded-lg bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors text-left">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-sidebar-primary text-sidebar-primary-foreground font-semibold">
                  {user.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
                  <p className="text-xs text-sidebar-foreground/70 truncate">{user.email}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-sidebar-foreground/70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/profile")}>
                <User className="mr-2 h-4 w-4" />Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/profile")}>
                <Settings className="mr-2 h-4 w-4" />Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link href="/login">
            <Button className="w-full" variant="default">
              <LogIn className="mr-2 h-4 w-4" />Sign In
            </Button>
          </Link>
        )}
      </div>
    </aside>
  )
}

// ── Mobile Header (top bar) ──────────────────────────────────────────────────
export function MobileHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    setDrawerOpen(false)
    router.push("/login")
  }

  return (
    <>
      {/* Top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-sidebar text-sidebar-foreground flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Image src="/nutrilife-icon.png" alt="NutriLife" width={34} height={34} priority className="rounded-lg" />
          <span className="font-bold text-base text-sidebar-foreground">NutriLife</span>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Slide-in drawer */}
      <div className={cn(
        "md:hidden fixed top-0 left-0 h-full w-72 z-50 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 ease-in-out shadow-2xl",
        drawerOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <Image src="/nutrilife-icon.png" alt="NutriLife" width={40} height={40} priority className="rounded-xl" />
            <div>
              <p className="font-bold text-sidebar-foreground">NutriLife</p>
              <p className="text-[10px] text-sidebar-foreground/60 tracking-widest uppercase">Track Your Health</p>
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-4 py-5 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent"
                    )}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    <span className="font-medium">{item.title}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User section */}
        <div className="px-4 py-4 border-t border-sidebar-border">
          {isAuthenticated && user ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-10 h-10 rounded-full bg-sidebar-primary text-sidebar-primary-foreground font-bold flex items-center justify-center shrink-0">
                  {user.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{user.name}</p>
                  <p className="text-xs text-sidebar-foreground/60 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Log out</span>
              </button>
            </div>
          ) : (
            <Link href="/login" onClick={() => setDrawerOpen(false)}>
              <Button className="w-full"><LogIn className="mr-2 h-4 w-4" />Sign In</Button>
            </Link>
          )}
        </div>
      </div>
    </>
  )
}

// ── Bottom Tab Bar ───────────────────────────────────────────────────────────
export function MobileNav() {
  const pathname = usePathname()
  const { isAuthenticated } = useAuth()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 pb-safe">
      <ul className="flex items-center justify-around px-2 py-1">
        {bottomNavItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  isActive ? "bg-primary/10" : ""
                )}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className={cn("text-[10px] font-medium", isActive ? "text-primary" : "")}>{item.title}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}