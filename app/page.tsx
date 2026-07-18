"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  ArrowRight, Star, Camera, BarChart3, Droplets, Timer, MessageCircle,
  Flame, Target, Utensils, Check, X, Sparkles, Activity, UserPlus,
  ClipboardList, ScanLine, Salad, Menu,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { getApiUrl } from "@/lib/api"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useCallback } from "react"
import confetti from "canvas-confetti"
import {
  motion, useScroll, useSpring, useTransform, useReducedMotion,
} from "framer-motion"

/* ═══════════════════════════════════════════════════════════════════════════
   NutriLife landing — light, product-forward redesign.
   References: "Optimize Me" (Behance), DietIQ, Wings Tech diet planner.
   Cream/green sections, big headlines with one green word, squircle cards,
   and ACCURATE phone miniatures of the real app screens.
   framer-motion drives all motion: progress bar, hero parallax, reveals.
   ═══════════════════════════════════════════════════════════════════════════ */

const CANVAS_GREEN = "#2e7d4f"
const CANVAS_GREEN_LT = "#3fae6e"
const CANVAS_AMBER = "#e0a531"

const FALLBACK_PLANS = [
  { id: 1, name: "3 Month Plan", duration_months: 3, final_price: 299, base_price: 299, badge: null as string | null, features: ["AI Food Analyzer", "Diet Planner", "Advanced Analytics", "Priority Support"] },
  { id: 2, name: "6 Month Plan", duration_months: 6, final_price: 549, base_price: 598, badge: "Most Popular", features: ["AI Food Analyzer", "Diet Planner", "Advanced Analytics", "Save ₹49"] },
  { id: 3, name: "1 Year Plan", duration_months: 12, final_price: 849, base_price: 1196, badge: "Best Value", features: ["AI Food Analyzer", "Diet Planner", "Advanced Analytics", "Save ₹347"] },
]

/* ── motion presets ───────────────────────────────────────────────────────── */
const EASE = [0.22, 1, 0.36, 1] as const

function useRevealProps(delay = 0) {
  const reduce = useReducedMotion()
  if (reduce) return {}
  return {
    initial: { opacity: 0, y: 32 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.25 },
    transition: { duration: 0.7, delay, ease: EASE },
  }
}

function Reveal({ children, delay = 0, className }: {
  children: React.ReactNode; delay?: number; className?: string
}) {
  const props = useRevealProps(delay)
  return <motion.div className={className} {...props}>{children}</motion.div>
}

/* ── cursor trail (fine pointers, motion-safe) ────────────────────────────── */
function CursorTrail() {
  const dotRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (window.matchMedia("(pointer: coarse)").matches) return
    const dot = dotRef.current
    if (!dot) return
    let raf = 0, tx = -100, ty = -100, x = -100, y = -100, seen = false
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return
      tx = e.clientX; ty = e.clientY
      if (!seen) { x = tx; y = ty; seen = true; dot.style.opacity = "0.4" }
    }
    const loop = () => {
      x += (tx - x) * 0.15; y += (ty - y) * 0.15
      dot.style.transform = `translate3d(${x - 6}px, ${y - 6}px, 0)`
      raf = requestAnimationFrame(loop)
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    raf = requestAnimationFrame(loop)
    return () => { window.removeEventListener("pointermove", onMove); cancelAnimationFrame(raf) }
  }, [])
  return (
    <div ref={dotRef} aria-hidden="true"
      className="fixed left-0 top-0 z-[90] pointer-events-none rounded-full"
      style={{ width: 12, height: 12, opacity: 0, background: "var(--primary)", filter: "blur(8px)", transition: "opacity .4s ease" }}
    />
  )
}

/* ── animated counter ─────────────────────────────────────────────────────── */
function Counter({ to, suffix = "", decimals = 0, className }: {
  to: number; suffix?: string; decimals?: number; className?: string
}) {
  const [n, setN] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started.current) return
      started.current = true
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(to); return }
      const t0 = performance.now()
      const step = (t: number) => {
        const p = Math.min((t - t0) / 1400, 1)
        setN(to * (1 - Math.pow(1 - p, 3)))
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [to])
  const shown = decimals ? n.toFixed(decimals) : Math.round(n).toLocaleString()
  return <span ref={ref} className={className}>{shown}{suffix}</span>
}

/* ═══════════ ACCURATE APP MINIATURES ══════════════════════════════════════
   Each mini reproduces the real screen's structure and copy:
   dashboard/page.tsx, food-analysis/page.tsx, diet-planner/page.tsx,
   onboarding/page.tsx, signup/page.tsx. ═══════════════════════════════════ */

function Phone({ children, className, featured = false }: {
  children: React.ReactNode; className?: string; featured?: boolean
}) {
  return (
    <div className={`relative rounded-[2rem] border bg-card shadow-2xl overflow-hidden ${featured ? "border-primary/40 shadow-primary/15" : "border-border shadow-foreground/5"} ${className ?? ""}`}>
      <div className="absolute left-1/2 top-2 -translate-x-1/2 w-16 h-1.5 rounded-full bg-foreground/10" aria-hidden="true" />
      <div className="pt-6 pb-3 px-3 h-full">{children}</div>
    </div>
  )
}

/* dashboard: Welcome back → 4 stat tiles → Momentum Matrix weekly bars */
function DashboardMini() {
  const bars = [42, 68, 55, 80, 62, 30, 74]
  return (
    <div className="text-left">
      <p className="text-[9px] font-black uppercase tracking-wide text-foreground">Welcome back!</p>
      <p className="text-[6.5px] text-muted-foreground mb-2">Track your health journey</p>
      <div className="grid grid-cols-2 gap-1 mb-2">
        <div className="rounded-lg bg-orange-500/10 p-1.5">
          <Flame className="w-2.5 h-2.5 text-orange-500 mb-0.5" aria-hidden="true" />
          <p className="text-[8px] font-black leading-none">1,847</p>
          <p className="text-[5.5px] text-muted-foreground">Daily Fuel</p>
        </div>
        <div className="rounded-lg bg-primary/10 p-1.5">
          <Target className="w-2.5 h-2.5 text-primary mb-0.5" aria-hidden="true" />
          <p className="text-[8px] font-black leading-none">86%</p>
          <p className="text-[5.5px] text-muted-foreground">Objective Sync</p>
        </div>
        <div className="rounded-lg bg-primary/10 p-1.5">
          <Droplets className="w-2.5 h-2.5 text-primary mb-0.5" aria-hidden="true" />
          <p className="text-[8px] font-black leading-none">6/8</p>
          <p className="text-[5.5px] text-muted-foreground">Fluid Intake</p>
        </div>
        <div className="rounded-lg bg-primary/10 p-1.5">
          <Utensils className="w-2.5 h-2.5 text-primary mb-0.5" aria-hidden="true" />
          <p className="text-[8px] font-black leading-none">4</p>
          <p className="text-[5.5px] text-muted-foreground">Logged Vitals</p>
        </div>
      </div>
      <div className="rounded-xl border border-border p-1.5">
        <div className="flex items-center gap-1 mb-1">
          <Activity className="w-2.5 h-2.5 text-orange-500" aria-hidden="true" />
          <p className="text-[6.5px] font-black uppercase">Momentum Matrix</p>
        </div>
        <div className="flex items-end gap-[3px] h-10">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 rounded-t-sm bg-orange-500" style={{ height: `${h}%`, opacity: i === 6 ? 1 : 0.4 }} />
          ))}
        </div>
        <div className="flex justify-between mt-0.5">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} className="text-[5px] text-muted-foreground flex-1 text-center">{d}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* food analysis: photo upload → identified dish → macro rows */
function ScannerMini() {
  return (
    <div className="text-left">
      <p className="text-[9px] font-black uppercase tracking-wide text-foreground mb-1.5">AI Food Analysis</p>
      <div className="relative rounded-xl overflow-hidden mb-1.5 border border-primary/30">
        <Image src="/hero-food-plate.png" width={200} height={112} alt="" className="w-full h-[72px] object-cover" />
        <div className="absolute inset-0 border-2 border-primary/60 rounded-xl" aria-hidden="true">
          <div className="absolute left-0 right-0 top-1/2 h-px bg-primary/70" />
        </div>
        <span className="absolute bottom-1 left-1 text-[6px] font-bold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
          <Camera className="w-1.5 h-1.5 inline mr-0.5" aria-hidden="true" />Scanning…
        </span>
      </div>
      <p className="text-[8px] font-black">Mediterranean Salad</p>
      <p className="text-[6px] text-muted-foreground mb-1">1 bowl · 420 kcal</p>
      {[
        ["Protein", "18g", 55], ["Carbs", "32g", 42], ["Fat", "24g", 66],
      ].map(([label, val, w]) => (
        <div key={label as string} className="flex items-center gap-1 mb-0.5">
          <span className="text-[6px] text-muted-foreground w-7">{label}</span>
          <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${w}%` }} />
          </div>
          <span className="text-[6px] font-bold">{val}</span>
        </div>
      ))}
    </div>
  )
}

/* diet planner: BMI/targets → macro chips → weekly rows */
function PlanMini() {
  return (
    <div className="text-left">
      <p className="text-[9px] font-black uppercase tracking-wide text-foreground mb-1.5">Your Diet Plan</p>
      <div className="rounded-xl bg-primary/10 p-1.5 mb-1.5 flex justify-between">
        <div><p className="text-[8px] font-black text-primary leading-none">22.9</p><p className="text-[5.5px] text-muted-foreground">BMI</p></div>
        <div><p className="text-[8px] font-black leading-none">1,680</p><p className="text-[5.5px] text-muted-foreground">BMR</p></div>
        <div><p className="text-[8px] font-black leading-none">2,200</p><p className="text-[5.5px] text-muted-foreground">Target kcal</p></div>
      </div>
      <div className="flex gap-1 mb-1.5">
        <span className="text-[6px] font-bold rounded-full bg-primary/15 text-primary px-1.5 py-0.5">P 140g</span>
        <span className="text-[6px] font-bold rounded-full bg-accent/20 text-accent-foreground px-1.5 py-0.5">C 250g</span>
        <span className="text-[6px] font-bold rounded-full bg-muted px-1.5 py-0.5">F 60g</span>
      </div>
      {[
        ["Mon", "Oats + Banana Bowl", "550"],
        ["Tue", "Paneer Quinoa Bowl", "500"],
        ["Wed", "Grilled Veg Wrap", "520"],
      ].map(([d, dish, kcal]) => (
        <div key={d as string} className="flex items-center justify-between rounded-lg border border-border px-1.5 py-1 mb-0.5">
          <span className="text-[6px] font-black text-primary w-5">{d}</span>
          <span className="text-[6.5px] flex-1 truncate">{dish}</span>
          <span className="text-[6px] text-muted-foreground">{kcal} kcal</span>
        </div>
      ))}
    </div>
  )
}

/* signup: logo → fields → CTA (Get started step) */
function SignupMini() {
  return (
    <div className="text-left">
      <div className="flex items-center gap-1 mb-2">
        <div className="w-3.5 h-3.5 rounded-md bg-primary" />
        <p className="text-[8px] font-black">NutriLife</p>
      </div>
      <p className="text-[8px] font-black mb-1.5">Create your account</p>
      {["Full name", "Email", "Password"].map((f) => (
        <div key={f} className="rounded-lg border border-border px-1.5 py-1 mb-1">
          <p className="text-[6px] text-muted-foreground">{f}</p>
        </div>
      ))}
      <div className="rounded-lg bg-primary text-primary-foreground text-center py-1 text-[7px] font-bold">Sign up</div>
    </div>
  )
}

/* onboarding: step dots → age/height/weight fields (real placeholders) */
function ProfileMini() {
  return (
    <div className="text-left">
      <div className="flex gap-1 mb-2">
        <div className="h-1 w-5 rounded-full bg-primary" />
        <div className="h-1 w-2 rounded-full bg-primary/40" />
        <div className="h-1 w-2 rounded-full bg-muted-foreground/20" />
      </div>
      <p className="text-[8px] font-black mb-1.5">Tell us about yourself</p>
      {[["Age", "25"], ["Height (cm)", "175"], ["Weight (kg)", "70"]].map(([l, v]) => (
        <div key={l as string} className="rounded-lg border border-border px-1.5 py-1 mb-1 flex justify-between">
          <p className="text-[6px] text-muted-foreground">{l}</p>
          <p className="text-[6px] font-bold">{v}</p>
        </div>
      ))}
      <div className="rounded-lg bg-primary text-primary-foreground text-center py-1 text-[7px] font-bold">Continue</div>
    </div>
  )
}

/* ═════════════════════════════ PAGE ═══════════════════════════════════════ */
export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(true)
  const [toast, setToast] = useState(false)
  const [chosen, setChosen] = useState(false)
  const [plans, setPlans] = useState(FALLBACK_PLANS)
  const reduce = useReducedMotion()

  const arenaRef = useRef<HTMLDivElement>(null)
  const junkRef = useRef<HTMLButtonElement>(null)
  const dodgesLeft = useRef(2 + Math.round(Math.random()))
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) router.push("/dashboard")
      else setIsRedirecting(false)
    }
  }, [isAuthenticated, isLoading, router])

  /* real pricing from the API; silent fallback to the same defaults it seeds */
  useEffect(() => {
    if (isRedirecting) return
    fetch(getApiUrl("/api/subscription/plans"))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length >= 3) {
          setPlans(data.slice(0, 3).map((p) => ({
            id: p.id, name: p.name, duration_months: p.duration_months,
            final_price: Math.round(Number(p.final_price)),
            base_price: Math.round(Number(p.base_price)),
            badge: p.badge, features: (p.features || []).slice(0, 4),
          })))
        }
      })
      .catch(() => {})
  }, [isRedirecting])

  /* scroll progress bar + nav solidify */
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 })
  const [navSolid, setNavSolid] = useState(false)
  /* nav collapses when a section link is picked; a floating button restores it */
  const [navHidden, setNavHidden] = useState(false)
  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => { setNavSolid(window.scrollY > 24); ticking = false })
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  /* hero parallax: phones drift at different speeds */
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress: heroP } = useScroll({ target: heroRef, offset: ["start start", "end start"] })
  const phoneL = useTransform(heroP, [0, 1], [0, reduce ? 0 : -40])
  const phoneC = useTransform(heroP, [0, 1], [0, reduce ? 0 : -90])
  const phoneR = useTransform(heroP, [0, 1], [0, reduce ? 0 : -55])
  const blobY = useTransform(heroP, [0, 1], [0, reduce ? 0 : 60])

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  /* ── the choice game (unchanged logic, restyled) ─────────────────────────── */
  const dodge = useCallback(() => {
    const arena = arenaRef.current, btn = junkRef.current
    if (!arena || !btn) return
    const a = arena.getBoundingClientRect(), b = btn.getBoundingClientRect()
    const maxX = Math.max(0, (a.width - b.width) / 2 - 8)
    const maxY = Math.max(0, (a.height - b.height) / 2 - 8)
    btn.style.setProperty("--dx", `${((Math.random() * 2 - 1) * maxX).toFixed(0)}px`)
    btn.style.setProperty("--dy", `${((Math.random() * 2 - 1) * maxY).toFixed(0)}px`)
    dodgesLeft.current -= 1
  }, [])

  const onJunkHover = useCallback(() => {
    if (!window.matchMedia("(pointer: coarse)").matches && dodgesLeft.current > 0) dodge()
  }, [dodge])

  const onJunkClick = useCallback(() => {
    if (dodgesLeft.current > 0) { dodge(); return }
    setToast(true)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(false), 3000)
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" })
  }, [dodge])

  const onHealthyClick = useCallback(() => {
    if (chosen) return
    setChosen(true)
    const btn = document.getElementById("game-healthy")
    let origin = { x: 0.5, y: 0.7 }
    if (btn) {
      const r = btn.getBoundingClientRect()
      origin = { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight }
    }
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      confetti({ particleCount: 120, spread: 75, startVelocity: 38, origin, colors: [CANVAS_GREEN, CANVAS_GREEN_LT, CANVAS_AMBER] })
      confetti({ particleCount: 60, spread: 120, startVelocity: 24, origin, colors: [CANVAS_GREEN_LT, CANVAS_AMBER] })
    }
    setTimeout(() => router.push("/login"), 1500)
  }, [chosen, router])

  if (isLoading || isRedirecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="bg-background text-foreground selection:bg-primary/20 overflow-x-clip">
      <a href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:font-bold">
        Skip to content
      </a>

      {/* scroll progress */}
      <motion.div aria-hidden="true" style={{ scaleX: progress }}
        className="fixed top-0 left-0 z-[80] h-[3px] w-full origin-left bg-primary motion-reduce:hidden" />

      <CursorTrail />

      {/* ── nav — collapses when a section link is picked ──────────────────── */}
      <nav aria-label="Main navigation" aria-hidden={navHidden}
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${navHidden ? "-translate-y-full pointer-events-none" : "translate-y-0"} ${navSolid ? "bg-background/85 backdrop-blur-xl border-b border-border shadow-sm" : "bg-transparent border-b border-transparent"}`}>
        <div className="container mx-auto px-6 h-16 md:h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group" tabIndex={navHidden ? -1 : 0}>
            <Image src="/nutrilife-icon.png" width={36} height={36} alt="NutriLife logo" className="rounded-xl shadow-sm" />
            <span className="font-black text-xl md:text-2xl tracking-tighter">NutriLife</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-muted-foreground">
            {[
              ["#features", "Features"], ["#how", "How it works"],
              ["#pricing", "Pricing"], ["#testimonials", "Reviews"],
            ].map(([href, label]) => (
              <Link key={href} href={href} onClick={() => setNavHidden(true)}
                tabIndex={navHidden ? -1 : 0} className="hover:text-primary transition-colors">
                {label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Link href="/login" tabIndex={navHidden ? -1 : 0}><Button variant="ghost" className="font-bold rounded-full" tabIndex={-1}>Log in</Button></Link>
            <Link href="/signup" tabIndex={navHidden ? -1 : 0}><Button className="font-bold rounded-full px-5 md:px-6" tabIndex={-1}>Join now</Button></Link>
          </div>
        </div>
      </nav>

      {/* floating restore button — brings the nav back */}
      <button type="button" onClick={() => setNavHidden(false)}
        aria-label="Show navigation" aria-hidden={!navHidden}
        tabIndex={navHidden ? 0 : -1}
        className={`fixed top-4 right-4 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center transition-all duration-300 hover:scale-110 focus-visible:outline-2 focus-visible:outline-ring ${navHidden ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"}`}>
        <Menu className="w-5 h-5" aria-hidden="true" />
      </button>

      <main id="main-content">

        {/* ── hero ──────────────────────────────────────────────────────────── */}
        <section ref={heroRef} className="relative overflow-hidden bg-secondary/60 dark:bg-secondary/30 pt-28 md:pt-36 pb-10 md:pb-16">
          <div aria-hidden="true" className="dot-grid absolute inset-0 opacity-60" />
          <motion.div aria-hidden="true" style={{ y: blobY }}
            className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
          <motion.div aria-hidden="true" style={{ y: blobY }}
            className="absolute -bottom-32 -left-24 w-80 h-80 rounded-full bg-accent/10 blur-3xl" />

          <div className="container mx-auto px-6 relative z-10 text-center">
            <Reveal>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-black text-xs uppercase tracking-widest border border-primary/20">
                <Sparkles className="w-4 h-4" aria-hidden="true" /> AI-powered nutrition
              </span>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-6 text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.02] text-balance max-w-4xl mx-auto">
                Know what to eat, <span className="text-primary">every single day.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-5 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Scan any meal with AI, get a plan built for your body, and watch
                your progress — no more guessing your food.
              </p>
            </Reveal>
            <Reveal delay={0.24}>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/signup">
                  <Button size="lg" className="h-14 px-8 text-base md:text-lg font-bold rounded-full shadow-lg shadow-primary/25 group">
                    Start free <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                  </Button>
                </Link>
                <Link href="#how">
                  <Button size="lg" variant="outline" className="h-14 px-8 text-base md:text-lg font-bold rounded-full border-primary/40 text-primary hover:bg-primary/5">
                    See how it works
                  </Button>
                </Link>
              </div>
            </Reveal>

            {/* real app, in miniature */}
            <div className="mt-14 md:mt-16 flex items-end justify-center gap-4 md:gap-8">
              <motion.div style={{ y: phoneL }} className="hidden sm:block w-44 md:w-52">
                <Reveal delay={0.15}><Phone className="h-[300px] md:h-[340px]"><DashboardMini /></Phone></Reveal>
              </motion.div>
              <motion.div style={{ y: phoneC }} className="w-52 md:w-60 relative z-10">
                <Reveal delay={0.05}><Phone featured className="h-[340px] md:h-[380px]"><ScannerMini /></Phone></Reveal>
              </motion.div>
              <motion.div style={{ y: phoneR }} className="hidden sm:block w-44 md:w-52">
                <Reveal delay={0.25}><Phone className="h-[300px] md:h-[340px]"><PlanMini /></Phone></Reveal>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── stats strip ───────────────────────────────────────────────────── */}
        <section aria-label="NutriLife in numbers" className="border-b border-border bg-background">
          <div className="container mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { v: 2000, s: "+", d: 0, label: "users joined" },
              { v: 4.9, s: "/5", d: 1, label: "average rating" },
              { v: 50000, s: "+", d: 0, label: "meals analyzed" },
              { v: 6, s: "", d: 0, label: "diet types supported" },
            ].map((m) => (
              <Reveal key={m.label}>
                <p className="text-3xl md:text-4xl font-black text-primary tabular-nums tracking-tight">
                  <Counter to={m.v} suffix={m.s} decimals={m.d} />
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">{m.label}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── problem → fix ─────────────────────────────────────────────────── */}
        <section className="py-20 md:py-28">
          <div className="container mx-auto px-6 max-w-5xl">
            <Reveal className="text-center mb-12">
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-balance">
                You track steps. You track sleep.<br />
                <span className="text-primary">But you guess your food.</span>
              </h2>
            </Reveal>
            <div className="grid md:grid-cols-2 gap-6">
              <Reveal>
                <div className="h-full rounded-[2rem] border border-border bg-card p-8">
                  <p className="font-black text-lg mb-5 flex items-center gap-2 text-muted-foreground">
                    <X className="w-5 h-5 text-destructive" aria-hidden="true" /> Guessing
                  </p>
                  <ul className="space-y-3 text-muted-foreground font-medium">
                    <li>"That looked like ~400 calories."</li>
                    <li>Generic diet plans that ignore your body.</li>
                    <li>Progress you can't see or measure.</li>
                  </ul>
                </div>
              </Reveal>
              <Reveal delay={0.12}>
                <div className="h-full rounded-[2rem] border-2 border-primary/40 bg-primary/5 p-8">
                  <p className="font-black text-lg mb-5 flex items-center gap-2 text-primary">
                    <Check className="w-5 h-5" aria-hidden="true" /> Knowing, with NutriLife
                  </p>
                  <ul className="space-y-3 font-medium">
                    <li>AI reads calories and macros from a photo.</li>
                    <li>Plans computed from your BMI, BMR and goal.</li>
                    <li>Every meal, glass of water and fast — tracked.</li>
                  </ul>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── how it works ──────────────────────────────────────────────────── */}
        <section id="how" className="py-20 md:py-28 bg-secondary/50 dark:bg-secondary/20 relative overflow-hidden scroll-mt-20">
          <div aria-hidden="true" className="dot-grid absolute inset-0 opacity-40" />
          <div className="container mx-auto px-6 relative z-10">
            <Reveal className="text-center mb-14">
              <span className="inline-block px-4 py-2 rounded-full bg-accent/15 text-accent-foreground dark:text-accent font-bold text-xs uppercase tracking-widest border border-accent/25 mb-5">
                Four steps
              </span>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight">How it <span className="text-primary">works</span></h2>
            </Reveal>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {[
                { n: "01", icon: UserPlus, title: "Get started", desc: "Create your free account in seconds.", mini: <SignupMini /> },
                { n: "02", icon: ClipboardList, title: "Your profile", desc: "Age, height, weight, goal — the basics.", mini: <ProfileMini /> },
                { n: "03", icon: ScanLine, title: "AI scan", desc: "Photograph meals; AI reads the nutrition.", mini: <ScannerMini /> },
                { n: "04", icon: Salad, title: "Your plan", desc: "A weekly plan tuned to your body.", mini: <PlanMini /> },
              ].map((s, i) => (
                <Reveal key={s.n} delay={i * 0.1}>
                  <div className="h-full rounded-[2rem] bg-card border border-border p-5 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                      <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <s.icon className="w-5 h-5" aria-hidden="true" />
                      </span>
                      <span className="text-2xl font-black text-primary/20">{s.n}</span>
                    </div>
                    <h3 className="font-black text-lg mb-1">{s.title}</h3>
                    <p className="text-sm text-muted-foreground font-medium mb-4">{s.desc}</p>
                    <div className="rounded-xl border border-border bg-background p-2.5">{s.mini}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── features bento ────────────────────────────────────────────────── */}
        <section id="features" className="py-20 md:py-28 scroll-mt-20">
          <div className="container mx-auto px-6 max-w-6xl">
            <Reveal className="text-center mb-14">
              <h2 className="text-3xl md:text-5xl font-black tracking-tight">
                Everything your diet <span className="text-primary">needs</span>
              </h2>
            </Reveal>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
              <Reveal className="col-span-2 row-span-2">
                <div className="h-full rounded-[2rem] bg-primary text-primary-foreground p-8 md:p-10 flex flex-col justify-between min-h-[300px] relative overflow-hidden group">
                  <div aria-hidden="true" className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-primary-foreground/10 group-hover:scale-125 transition-transform duration-500" />
                  <div>
                    <Camera className="w-10 h-10 mb-5" aria-hidden="true" />
                    <h3 className="text-2xl md:text-3xl font-black mb-3">AI Vision Scanner</h3>
                    <p className="font-medium opacity-90 max-w-sm">
                      Snap a photo — ingredients, portions, calories and macros
                      identified instantly, then logged to your diary.
                    </p>
                  </div>
                  <p className="text-sm font-bold opacity-75">photo → macros, in seconds</p>
                </div>
              </Reveal>
              {[
                { icon: BarChart3, title: "Deep Analytics", desc: "Weekly momentum, macros and trends." },
                { icon: Droplets, title: "Water Tracker", desc: "Glasses, goals and history." },
                { icon: Timer, title: "Fasting", desc: "16:8, 5:2 and more, with live status." },
                { icon: MessageCircle, title: "Health Chat", desc: "Ask the AI anything nutrition." },
              ].map((f, i) => (
                <Reveal key={f.title} delay={i * 0.08}>
                  <div className="h-full rounded-[2rem] bg-card border border-border p-6 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300">
                    <span className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                      <f.icon className="w-5 h-5" aria-hidden="true" />
                    </span>
                    <h3 className="font-black mb-1">{f.title}</h3>
                    <p className="text-sm text-muted-foreground font-medium">{f.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── pricing ───────────────────────────────────────────────────────── */}
        <section id="pricing" className="py-20 md:py-28 bg-secondary/50 dark:bg-secondary/20 scroll-mt-20">
          <div className="container mx-auto px-6 max-w-5xl">
            <Reveal className="text-center mb-14">
              <h2 className="text-3xl md:text-5xl font-black tracking-tight">
                Simple <span className="text-primary">pricing</span>
              </h2>
              <p className="mt-4 text-muted-foreground text-lg font-medium">Free to start. Upgrade when you're ready.</p>
            </Reveal>
            <div className="grid md:grid-cols-3 gap-6 items-stretch">
              {plans.map((p, i) => {
                const popular = i === 1
                return (
                  <Reveal key={p.id} delay={i * 0.1}>
                    <div className={`h-full rounded-[2rem] p-8 flex flex-col ${popular ? "bg-card border-2 border-primary shadow-xl shadow-primary/15" : "bg-card border border-border"}`}>
                      {p.badge && (
                        <span className={`self-start text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full mb-4 ${popular ? "bg-primary text-primary-foreground" : "bg-accent/15 text-accent-foreground dark:text-accent"}`}>
                          {p.badge}
                        </span>
                      )}
                      <h3 className="font-black text-lg">{p.name}</h3>
                      <p className="mt-3 mb-1">
                        <span className="text-4xl font-black tracking-tight">₹{p.final_price}</span>
                        {p.base_price > p.final_price && (
                          <span className="ml-2 text-muted-foreground line-through font-bold">₹{p.base_price}</span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground font-medium mb-6">
                        ₹{Math.round(p.final_price / p.duration_months)}/month · {p.duration_months} months
                      </p>
                      <ul className="space-y-2.5 mb-8 flex-1">
                        {p.features.map((f: string) => (
                          <li key={f} className="flex items-start gap-2 text-sm font-medium">
                            <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" aria-hidden="true" /> {f}
                          </li>
                        ))}
                      </ul>
                      <Link href="/signup" className="mt-auto">
                        <Button className="w-full rounded-full font-bold" variant={popular ? "default" : "outline"}>
                          Get started
                        </Button>
                      </Link>
                    </div>
                  </Reveal>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── testimonials ──────────────────────────────────────────────────── */}
        <section id="testimonials" className="py-20 md:py-28 scroll-mt-20">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-12">
              <Reveal>
                <h2 className="text-3xl md:text-5xl font-black tracking-tight">
                  Loved by <span className="text-primary">enthusiasts</span>
                </h2>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="flex items-center gap-2 bg-card px-5 py-3 rounded-2xl border border-border">
                  <Star className="w-5 h-5 fill-accent text-accent" aria-hidden="true" />
                  <span className="font-black text-xl">4.9/5</span>
                  <span className="text-muted-foreground text-sm font-semibold">average rating</span>
                </div>
              </Reveal>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { name: "Sarah Mitchell", role: "Pro Athlete", initials: "SM", text: "The AI scanner is a game-changer for my prep. I no longer waste hours looking up obscure macros. It's fast, accurate, and essential." },
                { name: "Rahul Kapoor", role: "Fitness Enthusiast", initials: "RK", text: "Finding a dietitian that understands Indian cuisine is hard. NutriLife's AI handles it perfectly, giving me customized high-protein plans." },
              ].map((t, i) => (
                <Reveal key={t.name} delay={i * 0.1}>
                  <article className="h-full rounded-[2rem] bg-card border border-border p-8">
                    <div className="flex gap-1 text-accent mb-5" aria-label="5 out of 5 stars">
                      {[0, 1, 2, 3, 4].map((s) => <Star key={s} className="w-4 h-4 fill-current" aria-hidden="true" />)}
                    </div>
                    <p className="text-lg font-bold leading-relaxed mb-6 italic">"{t.text}"</p>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center font-black text-primary">{t.initials}</div>
                      <div>
                        <p className="font-black">{t.name}</p>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t.role}</p>
                      </div>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── the choice game ───────────────────────────────────────────────── */}
        <section aria-label="Make your choice" className="py-20 md:py-24 bg-secondary/50 dark:bg-secondary/20 relative overflow-hidden">
          <div aria-hidden="true" className="dot-grid absolute inset-0 opacity-40" />
          <div className="container mx-auto px-6 text-center relative z-10">
            <Reveal>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-3">
                One last choice. <span className="text-primary">What do you pick?</span>
              </h2>
              <p className="text-muted-foreground font-medium mb-12">(Choose wisely — one of them has other plans.)</p>
            </Reveal>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <Reveal>
                <div ref={arenaRef} className="relative h-56 md:h-64 rounded-[2rem] border border-border bg-card overflow-hidden">
                  <button ref={junkRef} type="button" onMouseEnter={onJunkHover} onClick={onJunkClick}
                    aria-label="Pick the burger" className="game-junk absolute left-1/2 top-1/2 flex flex-col items-center gap-2 rounded-3xl p-6 focus-visible:outline-2 focus-visible:outline-ring">
                    <span className="text-7xl md:text-8xl" aria-hidden="true">🍔</span>
                    <span className="font-bold text-sm text-muted-foreground">Burger</span>
                  </button>
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="relative h-56 md:h-64 rounded-[2rem] border-2 border-primary/40 bg-primary/5 overflow-hidden">
                  <button id="game-healthy" type="button" onClick={onHealthyClick} disabled={chosen}
                    aria-label="Pick the salad"
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 rounded-3xl p-6 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-70">
                    <span className="text-7xl md:text-8xl" aria-hidden="true">🥗</span>
                    <span className="font-bold text-sm text-primary">{chosen ? "Great choice! 🌿" : "Salad"}</span>
                  </button>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── CTA banner ────────────────────────────────────────────────────── */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-6">
            <Reveal>
              <div className="bg-primary rounded-[2.5rem] p-10 md:p-16 text-center text-primary-foreground relative overflow-hidden">
                <div aria-hidden="true" className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-primary-foreground/10" />
                <div className="relative z-10 max-w-2xl mx-auto">
                  <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight text-balance">Ready to meet the new you?</h2>
                  <p className="text-lg md:text-xl opacity-90 mb-8 font-medium">Free to start. No credit card required.</p>
                  <Link href="/signup">
                    <Button size="lg" variant="secondary"
                      className="h-14 px-10 text-lg font-bold rounded-full bg-background text-primary hover:bg-background/90 hover:scale-105 transition-transform">
                      Start your journey <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                    </Button>
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* ── footer (kept) ─────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-16 md:py-20 bg-background relative z-10">
        <div className="container mx-auto px-6 grid md:grid-cols-4 gap-12 text-left mb-16">
          <div className="col-span-2">
            <div className="flex flex-row items-center gap-2 mb-6">
              <Image src="/nutrilife-icon.png" width={32} height={32} alt="NutriLife logo" className="rounded-lg" />
              <span className="font-bold text-xl">NutriLife</span>
            </div>
            <p className="text-muted-foreground max-w-sm leading-relaxed font-medium">
              Empowering your health journey with advanced artificial intelligence and personalized nutrition.
            </p>
          </div>
          <div>
            <h4 className="font-black mb-6 uppercase tracking-widest text-xs">Product</h4>
            <ul className="space-y-4 text-sm font-bold text-muted-foreground">
              <li><Link href="#features" className="hover:text-primary transition-all">Features</Link></li>
              <li><Link href="#pricing" className="hover:text-primary transition-all">Pricing</Link></li>
              <li><Link href="/login" className="hover:text-primary transition-all">App Login</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-black mb-6 uppercase tracking-widest text-xs">Support</h4>
            <ul className="space-y-4 text-sm font-bold text-muted-foreground">
              <li><Link href="/support" className="hover:text-primary transition-all">Help Center</Link></li>
              <li><Link href="/terms" className="hover:text-primary transition-all">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-primary transition-all">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto px-6 pt-10 border-t border-border flex flex-col md:flex-row justify-between items-center gap-6 text-sm font-bold text-muted-foreground">
          <p>© {new Date().getFullYear()} NutriLife AI. Built for excellence.</p>
          <div className="flex items-center gap-8">
            <Link href="#" className="hover:text-primary transition-all">Twitter</Link>
            <Link href="#" className="hover:text-primary transition-all">Instagram</Link>
            <Link href="#" className="hover:text-primary transition-all">LinkedIn</Link>
          </div>
        </div>
      </footer>

      {/* toast — junk food verdict */}
      <div role="status" aria-live="polite"
        className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[95] px-6 py-4 rounded-2xl bg-destructive text-destructive-foreground font-bold shadow-2xl transition-all duration-300 ${toast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
        For being healthy, you need to eat healthy 🌿
      </div>

      <style jsx global>{`
        .dot-grid {
          background-image: radial-gradient(oklch(0.5 0.15 145 / 0.14) 1px, transparent 1px);
          background-size: 22px 22px;
        }
        .dark .dot-grid {
          background-image: radial-gradient(oklch(0.6 0.18 145 / 0.12) 1px, transparent 1px);
        }
        .game-junk {
          transform: translate(-50%, -50%) translate(var(--dx, 0px), var(--dy, 0px));
        }
        @media (prefers-reduced-motion: no-preference) {
          .game-junk { transition: transform .2s cubic-bezier(.34,1.3,.64,1); }
        }
      `}</style>
    </div>
  )
}
