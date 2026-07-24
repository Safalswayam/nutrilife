"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Check, Sparkles, Zap, Crown, Loader2, ShieldCheck, RefreshCw } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { getApiUrl } from "@/lib/api"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface SubscriptionPlan {
  id: number
  name: string
  duration_months: number
  base_price: number
  final_price: number
  discount_amount: number
  badge: string | null
  features: string[]
  savings_percentage: number
  monthly_equivalent: number
}

/* Mirrors the defaults in api/index.py's /api/subscription/plans handler, so a
   backend hiccup degrades to the same offer rather than an empty page. */
const FALLBACK_PLANS: SubscriptionPlan[] = [
  {
    id: 1, name: "3-Month Premium", duration_months: 3,
    base_price: 299, final_price: 299, discount_amount: 0, badge: null,
    features: ["AI Food Analyzer", "Diet Planner", "Advanced Nutrition Analytics", "Meal Tracking History"],
    savings_percentage: 0, monthly_equivalent: Math.round(299 / 3),
  },
  {
    id: 2, name: "6-Month Premium", duration_months: 6,
    base_price: 598, final_price: 549, discount_amount: 49, badge: "Most Popular",
    features: ["AI Food Analyzer", "Diet Planner", "Advanced Nutrition Analytics", "Meal Tracking History", "Priority Support"],
    savings_percentage: Math.round((49 / 598) * 100), monthly_equivalent: Math.round(549 / 6),
  },
  {
    id: 3, name: "1-Year Premium", duration_months: 12,
    base_price: 1196, final_price: 849, discount_amount: 347, badge: "Best Value",
    features: ["AI Food Analyzer", "Diet Planner", "Advanced Nutrition Analytics", "Meal Tracking History", "Priority Support", "Exclusive Updates"],
    savings_percentage: Math.round((347 / 1196) * 100), monthly_equivalent: Math.round(849 / 12),
  },
]

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) { resolve(true); return }
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

/** Detect if user is on a mobile device */
function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

export default function SubscriptionPage() {
  const { token, user } = useAuth()
  const router = useRouter()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null)
  const [processing, setProcessing] = useState(false)
  const [showMonthly, setShowMonthly] = useState(false)
  const [usingFallback, setUsingFallback] = useState(false)
  const [currentSubscription, setCurrentSubscription] = useState<any>(null)

  useEffect(() => {
    fetchPlans()
    if (token) fetchCurrentSubscription()
    
    // Handle redirect callbacks from Razorpay
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const paymentStatus = params.get("payment")
      const reason = params.get("reason")
      if (paymentStatus === "success") {
        toast.success("Subscription activated! Welcome to NutriLife Premium!")
        router.replace("/subscription")
      } else if (paymentStatus === "failed") {
        toast.error(reason ? decodeURIComponent(reason) : "Payment failed or was cancelled")
        router.replace("/subscription")
      }
    }
  }, [token, router])

  const fetchPlans = async () => {
    try {
      const res = await fetch(getApiUrl("/api/subscription/plans"))
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      if (!Array.isArray(data) || data.length === 0) throw new Error("Empty")
      setPlans(data.map((p: any) => ({
        ...p,
        features: Array.isArray(p.features) ? p.features
          : typeof p.features === "string" ? JSON.parse(p.features) : [],
        monthly_equivalent: p.monthly_equivalent ?? Math.round(p.final_price / p.duration_months),
        savings_percentage: p.savings_percentage ?? 0,
      })))
    } catch {
      // Never leave the page with nothing to choose from. Previously a failed
      // request left `plans` empty and the whole pricing grid rendered blank,
      // so there was no way to subscribe at all. These mirror the API's own
      // defaults; checkout still validates the real price server-side.
      setPlans(FALLBACK_PLANS)
      setUsingFallback(true)
    } finally {
      setLoading(false)
    }
  }

  const fetchCurrentSubscription = async () => {
    try {
      const res = await fetch(getApiUrl("/api/subscription/my-subscription"), {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) setCurrentSubscription(await res.json())
      // 404 = no subscription yet, perfectly fine
    } catch { /* no subscription */ }
  }

  const handleSubscribe = async (planId: number) => {
    if (!token) { toast.error("Please login to subscribe"); router.push("/login"); return }
    setProcessing(true); setSelectedPlan(planId)
    try {
      const loaded = await loadRazorpayScript()
      if (!loaded) throw new Error("Failed to load payment gateway. Check your internet connection.")

      const createRes = await fetch(getApiUrl("/api/subscription/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan_id: planId })
      })
      const createData = await createRes.json()
      if (!createRes.ok) throw new Error(createData.detail || "Failed to create subscription")

      const plan = plans.find(p => p.id === planId)
      const mobile = isMobileDevice()

      await new Promise<void>((resolve, reject) => {
        const options: Record<string, any> = {
          key: createData.key_id,
          order_id: createData.order_id,
          amount: createData.amount,
          currency: createData.currency || "INR",
          name: "NutriLife Premium",
          description: plan?.name ?? createData.plan_name ?? "Premium Plan",
          image: "/icon.svg",
          prefill: {
            name: user?.name ?? "",
            email: user?.email ?? "",
          },
          notes: {
            user_id: String(user?.id ?? ""),
            plan_id: String(planId),
            plan_name: plan?.name ?? "",
          },
          theme: { color: "#2d5a3d" },
          retry: { enabled: false },
          handler: async (response: any) => {
            try {
              const verifyRes = await fetch(getApiUrl("/api/subscription/verify-payment"), {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                  plan_id: planId
                })
              })
              const verifyData = await verifyRes.json()
              if (!verifyRes.ok) throw new Error(verifyData.detail || "Payment verification failed")
              toast.success("Subscription activated! Welcome to NutriLife Premium!")
              await fetchCurrentSubscription()
              setTimeout(() => window.location.reload(), 1500)
              resolve()
            } catch (err: any) { reject(err) }
          },
          modal: {
            ondismiss: () => reject(new Error("cancelled")),
            confirm_close: false,
            escape: true,
            animation: true,
          },
        }

        // Mobile: use callback_url and redirect for robust intent handling
        if (mobile) {
          options.callback_url = getApiUrl("/api/subscription/callback")
          options.redirect = true
        }

        const rzp = new (window as any).Razorpay(options)
        rzp.on("payment.failed", (r: any) => {
          const errDesc = r.error?.description || "Payment failed"
          const errReason = r.error?.reason || ""
          console.error("Payment failed:", r.error)
          reject(new Error(`${errDesc}${errReason ? ` (${errReason})` : ""}`))
        })
        rzp.open()
      })
    } catch (err: any) {
      if (err.message !== "cancelled") toast.error(err.message || "Failed to process subscription")
    } finally {
      setProcessing(false); setSelectedPlan(null)
    }
  }

  const getPlanIcon = (m: number) =>
    m === 3 ? <Sparkles className="w-5 h-5 text-primary" />
    : m === 6 ? <Zap className="w-5 h-5 text-[color:var(--warning)]" />
    : <Crown className="w-5 h-5 text-primary" />

  const fmt = (p: number) => `₹${Math.round(p)}`

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
      <p className="text-muted-foreground">Loading plans...</p>
    </div>
  )

  return (
    <div className="p-3 md:p-8 space-y-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center reveal-3d space-y-6">
        <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full glass-card border-none bg-primary/10 text-primary mb-4">
           <Crown className="w-4 h-4" />
           <span className="text-[10px] font-semibold uppercase tracking-[0.28em]">Choose your rhythm</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-semibold tracking-[-0.04em] text-foreground leading-[1.05]">
          One clear plan.<br /><span className="text-primary">Your pace.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Start simply. Keep the tools that help you stay consistent.
        </p>
        <div className="flex items-center justify-center gap-6 pt-4">
           {[
             { label: "2K+ Optimized", icon: Zap },
             { label: "AI Synchronized", icon: Sparkles },
             { label: "Global Standard", icon: ShieldCheck }
           ].map((item, i) => (
             <div key={i} className="flex items-center gap-2 opacity-40">
                <item.icon className="w-4 h-4 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
             </div>
           ))}
        </div>
      </div>

      {/* Active subscription banner */}
      {currentSubscription && (
        <div className="max-w-3xl mx-auto reveal-3d">
          <div className="glass-card rounded-[2.5rem] bg-gradient-to-r from-primary/20 via-primary/5 to-transparent border-none p-1 shadow-3xl shadow-primary/20">
            <div className="bg-background/40 backdrop-blur-3xl rounded-[2.3rem] p-8">
              <div className="flex items-center justify-between flex-wrap gap-6">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center shadow-inner">
                    <Crown className="w-8 h-8 text-primary animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">Status: Authorized</p>
                    <p className="text-2xl font-black text-foreground uppercase">{currentSubscription.plan_name}</p>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-tighter">{currentSubscription.days_remaining} units of time remaining in current cycle</p>
                  </div>
                </div>
                <div className="px-6 py-2 rounded-full border-2 border-primary/30 text-primary text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
                  System Active
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Price toggle */}
      <div className="flex items-center justify-center gap-3 reveal-3d">
        <Label className={cn("text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all", !showMonthly ? "bg-white/10 text-foreground" : "text-muted-foreground opacity-40")}>Pay yearly</Label>
        <Switch checked={showMonthly} onCheckedChange={setShowMonthly} className="data-[state=checked]:bg-primary" />
        <Label className={cn("text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all", showMonthly ? "bg-white/10 text-foreground" : "text-muted-foreground opacity-40")}>Pay monthly</Label>
      </div>

      {/* Live prices are confirmed at checkout, so say so when these are local defaults */}
      {usingFallback && (
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-3 rounded-2xl border border-border bg-secondary/60 px-5 py-3">
          <RefreshCw className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground text-center">
            We couldn&apos;t reach the pricing service, so these are our standard plans. The exact
            amount is confirmed at checkout.{" "}
            <button
              type="button"
              onClick={() => { setUsingFallback(false); setLoading(true); fetchPlans() }}
              className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline"
            >
              Try again
            </button>
          </p>
        </div>
      )}

      {/* Pricing cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => {
          const isBest = !!plan.badge?.includes("Best")
          const isPopular = !!plan.badge?.includes("Popular")
          const isProcessing = processing && selectedPlan === plan.id

          return (
            <div key={plan.id} className="reveal-3d">
              <Card className={cn(
                "relative h-full flex flex-col border-none glass-card rounded-[3rem] overflow-hidden transition-all duration-500 hover:-translate-y-4 group",
                isBest ? "shadow-3xl shadow-primary/30 ring-2 ring-primary/50" : "opacity-80 hover:opacity-100"
              )}>
                {plan.badge && (
                  <div className="absolute -top-0 left-0 right-0 h-1 bg-primary" />
                )}
                
                <CardHeader className="text-center p-10 pb-4">
                  <div className="mx-auto mb-6 w-16 h-16 rounded-[1.5rem] bg-white/5 border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {getPlanIcon(plan.duration_months)}
                  </div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-2">{plan.badge || "Standard Tier"}</h3>
                  <CardTitle className="text-2xl font-black uppercase tracking-tight">{plan.name}</CardTitle>
                </CardHeader>

                <CardContent className="px-10 flex-1 flex flex-col text-center">
                  <div className="mb-10">
                    {!showMonthly ? (
                      <div>
                        {plan.discount_amount > 0 && (
                          <p className="text-xs font-bold text-muted-foreground line-through opacity-40">{fmt(plan.base_price)}</p>
                        )}
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-6xl font-black text-foreground">{fmt(plan.final_price)}</span>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-2">{plan.duration_months} Month Access</p>
                        {plan.discount_amount > 0 && (
                          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest">
                            Save {fmt(plan.discount_amount)} ({plan.savings_percentage}%)
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-6xl font-black text-foreground">{fmt(plan.monthly_equivalent)}</span>
                          <span className="text-xl font-black text-muted-foreground uppercase">/mo</span>
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-4">
                          Accumulated {fmt(plan.final_price)} per cycle
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 mb-8 text-left border-t border-white/5 pt-8">
                    {plan.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        <span className="text-xs font-bold text-muted-foreground/80 tracking-tight leading-relaxed">{f}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>

                <CardFooter className="p-10 pt-0">
                  <Button
                    className={cn(
                       "w-full h-16 rounded-[1.5rem] text-sm font-black uppercase tracking-[0.2em] shadow-3xl transition-all",
                        "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20"
                    )}
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={processing || !!currentSubscription}
                  >
                    {isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Syncing…</>
                      : currentSubscription ? "Current plan" : "Choose this plan"}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )
        })}
      </div>

      {/* Trust badges */}
      <div className="flex flex-wrap justify-center gap-4 md:gap-8 mt-8 md:mt-12 text-xs md:text-sm text-muted-foreground">
        <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /><span>Secure payments via Razorpay</span></div>
        <div className="flex items-center gap-2"><RefreshCw className="w-5 h-5 text-primary" /><span>7-day money-back guarantee</span></div>
        <div className="flex items-center gap-2"><Check className="w-5 h-5 text-primary" /><span>Cancel anytime</span></div>
      </div>

      {/* What's included */}
      <div className="max-w-4xl mx-auto reveal-3d">
        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-center mb-12 opacity-40">What each plan includes</h2>
        <div className="glass-card rounded-[3rem] p-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-3"><Crown className="w-6 h-6 text-primary" /> In Premium</h3>
              <div className="space-y-4">
                {["Photo food analysis","Detailed nutrition insights","Full history","Priority support"].map(f => (
                  <div key={f} className="flex items-center gap-3">
                     <div className="w-2 h-2 rounded-full bg-primary" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-70">{f}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-6 md:border-l md:border-white/5 md:pl-12">
              <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-3 opacity-60"><Check className="w-6 h-6 text-primary" /> In Free</h3>
              <div className="space-y-4">
                {["Diet planner","Water tracking","Dashboard","Your profile","Manual meal logging"].map(f => (
                  <div key={f} className="flex items-center gap-3">
                     <div className="w-2 h-2 rounded-full bg-primary" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center reveal-3d space-y-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Direct System Inquiries</p>
        <Link href="/support" className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl glass-card text-xs font-black uppercase tracking-widest text-primary hover:bg-primary hover:text-primary-foreground transition-all">
          Internal Communication Network →
        </Link>
      </div>
    </div>
  )
}
