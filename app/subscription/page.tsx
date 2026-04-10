"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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

export default function SubscriptionPage() {
  const { token, user } = useAuth()
  const router = useRouter()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null)
  const [processing, setProcessing] = useState(false)
  const [showMonthly, setShowMonthly] = useState(false)
  const [currentSubscription, setCurrentSubscription] = useState<any>(null)

  useEffect(() => {
    fetchPlans()
    if (token) fetchCurrentSubscription()
  }, [token])

  const fetchPlans = async () => {
    try {
      const res = await fetch(getApiUrl("/api/subscription/plans"))
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setPlans(data.map((p: any) => ({
        ...p,
        features: Array.isArray(p.features) ? p.features
          : typeof p.features === "string" ? JSON.parse(p.features) : [],
        monthly_equivalent: p.monthly_equivalent ?? Math.round(p.final_price / p.duration_months),
        savings_percentage: p.savings_percentage ?? 0,
      })))
    } catch {
      toast.error("Failed to load plans. Please refresh.")
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

      await new Promise<void>((resolve, reject) => {
        const rzp = new (window as any).Razorpay({
          key: createData.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          order_id: createData.order_id,
          amount: createData.amount,
          currency: createData.currency || "INR",
          name: "NutriLife Premium",
          description: createData.plan_name ?? "Premium Plan",
          image: "/icon.svg",
          prefill: {
            name: user?.name ?? "",
            email: user?.email ?? "",
          },
          theme: { color: "#2d5a3d" },
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
          modal: { ondismiss: () => reject(new Error("cancelled")) }
        })
        rzp.on("payment.failed", (r: any) => reject(new Error(r.error?.description || "Payment failed")))
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
    : m === 6 ? <Zap className="w-5 h-5 text-orange-500" />
    : <Crown className="w-5 h-5 text-primary" />

  const fmt = (p: number) => `₹${Math.round(p)}`

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
      <p className="text-muted-foreground">Loading plans...</p>
    </div>
  )

  return (
    <div className="container mx-auto px-4 py-6 md:py-16 max-w-7xl">
      {/* Header */}
      <div className="text-center mb-12">
        <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 text-sm px-4 py-1">Premium Plans</Badge>
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Unlock AI-powered food analysis, advanced analytics, and priority support. Cancel anytime.
        </p>
      </div>

      {/* Active subscription banner */}
      {currentSubscription && (
        <div className="max-w-2xl mx-auto mb-10">
          <Card className="border-primary bg-primary/5">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Active: {currentSubscription.plan_name}</p>
                    <p className="text-sm text-muted-foreground">{currentSubscription.days_remaining} days remaining</p>
                  </div>
                </div>
                <Badge className="bg-primary text-white">Premium Active</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Price toggle */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <Label className={!showMonthly ? "font-semibold" : "text-muted-foreground"}>Total Price</Label>
        <Switch checked={showMonthly} onCheckedChange={setShowMonthly} />
        <Label className={showMonthly ? "font-semibold" : "text-muted-foreground"}>Per Month</Label>
      </div>

      {/* Pricing cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => {
          const isBest = !!plan.badge?.includes("Best")
          const isPopular = !!plan.badge?.includes("Popular")
          const isProcessing = processing && selectedPlan === plan.id

          return (
            <Card key={plan.id} className={`relative flex flex-col transition-all duration-200 ${
              isBest ? "border-2 border-primary shadow-xl scale-105 z-10"
              : isPopular ? "border-2 border-orange-400 shadow-lg"
              : "border hover:shadow-md"
            }`}>
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <Badge className={`px-4 py-1 text-sm ${isBest ? "bg-primary text-white" : "bg-orange-500 text-white"}`}>
                    {plan.badge}
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pt-8 pb-2">
                <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  {getPlanIcon(plan.duration_months)}
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.duration_months} months of premium access</CardDescription>
              </CardHeader>

              <CardContent className="text-center flex-1">
                <div className="mb-6">
                  {!showMonthly ? (
                    <>
                      {plan.discount_amount > 0 && (
                        <p className="text-sm text-muted-foreground line-through mb-1">{fmt(plan.base_price)}</p>
                      )}
                      <div className="flex items-baseline justify-center gap-1 mb-2">
                        <span className="text-4xl font-bold">{fmt(plan.final_price)}</span>
                        <span className="text-muted-foreground text-sm">total</span>
                      </div>
                      {plan.discount_amount > 0 && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Save {fmt(plan.discount_amount)} ({plan.savings_percentage}% off)
                        </Badge>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline justify-center gap-1 mb-2">
                        <span className="text-4xl font-bold">{fmt(plan.monthly_equivalent)}</span>
                        <span className="text-muted-foreground text-sm">/month</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Billed {fmt(plan.final_price)} for {plan.duration_months} months
                      </p>
                    </>
                  )}
                </div>

                <ul className="space-y-2 text-left mb-4">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-0">
                <Button
                  className="w-full" size="lg"
                  variant={isBest ? "default" : "outline"}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={processing || !!currentSubscription}
                >
                  {isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                    : currentSubscription ? "Current Plan" : "Get Started →"}
                </Button>
              </CardFooter>
            </Card>
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
      <div className="max-w-4xl mx-auto mt-16">
        <h2 className="text-2xl font-bold text-center mb-8">What's Included</h2>
        <Card><CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Crown className="w-5 h-5 text-primary" />Premium Features</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {["AI-Powered Food Analysis","Advanced Nutrition Analytics","Full Meal History & Tracking","Priority Support"].map(f => (
                  <li key={f} className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" />{f}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Check className="w-5 h-5 text-green-500" />Always Free</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {["Diet Planner","Water Intake Tracking","Basic Dashboard","Profile Management","Manual Calorie Logging"].map(f => (
                  <li key={f} className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />{f}</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent></Card>
      </div>

      <div className="text-center mt-12 text-sm text-muted-foreground">
        Questions? Visit{" "}
        <Link href="/support" className="text-primary underline underline-offset-4">
          Support & Telegram
        </Link>
        {" "}for help.
      </div>
    </div>
  )
}
