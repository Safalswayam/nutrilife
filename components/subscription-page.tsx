"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Check, Sparkles, Zap, Crown, Loader2 } from "lucide-react"
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
    if (token) {
      fetchCurrentSubscription()
    }
  }, [token])

  const fetchPlans = async () => {
    try {
      const response = await fetch(getApiUrl("/api/subscription/plans"))
      const data = await response.json()
      setPlans(data)
    } catch (error) {
      console.error("Failed to fetch plans:", error)
      toast.error("Failed to load subscription plans")
    } finally {
      setLoading(false)
    }
  }

  const fetchCurrentSubscription = async () => {
    try {
      const response = await fetch(getApiUrl("/api/subscription/my-subscription"), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setCurrentSubscription(data)
      }
    } catch (error) {
      // User doesn't have active subscription
      console.log("No active subscription")
    }
  }

  // Load Razorpay checkout script once
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true)
        return
      }
      const script = document.createElement("script")
      script.src = "https://checkout.razorpay.com/v1/checkout.js"
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  const handleSubscribe = async (planId: number) => {
    if (!token) {
      toast.error("Please login to subscribe")
      router.push("/login")
      return
    }

    setProcessing(true)
    setSelectedPlan(planId)

    try {
      // ── Step 1: Load Razorpay SDK ──────────────────────────────────────────
      const scriptLoaded = await loadRazorpayScript()
      if (!scriptLoaded) {
        throw new Error("Failed to load payment gateway. Please try again.")
      }

      // ── Step 2: Create Razorpay Subscription on backend ───────────────────
      const createResponse = await fetch(getApiUrl("/api/subscription/create"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ plan_id: planId })
      })

      const createData = await createResponse.json()
      if (!createResponse.ok) {
        throw new Error(createData.detail || "Failed to create subscription")
      }

      // ── Step 3: Open Razorpay Subscription Checkout ───────────────────────
      await new Promise<void>((resolve, reject) => {
        const options = {
          key: createData.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          subscription_id: createData.subscription_id,  // <-- subscription, not order
          name: "NutriLife Premium",
          description: createData.plan_name,
          image: "/icon.svg",
          handler: async (response: any) => {
            // ── Step 4: Verify payment signature on backend ────────────────
            try {
              const verifyResponse = await fetch(getApiUrl("/api/subscription/verify-payment"), {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_subscription_id: response.razorpay_subscription_id,
                  razorpay_signature: response.razorpay_signature,
                  plan_id: planId
                })
              })

              const verifyData = await verifyResponse.json()
              if (!verifyResponse.ok) {
                throw new Error(verifyData.detail || "Payment verification failed")
              }

              toast.success("🎉 Subscription activated! Welcome to NutriLife Premium!")
              await fetchCurrentSubscription()
              // Force a page reload so auth context picks up new subscription_status
              setTimeout(() => window.location.reload(), 1500)
              resolve()
            } catch (err: any) {
              reject(err)
            }
          },
          prefill: {
            name: user?.name || "",
            email: user?.email || ""
          },
          theme: { color: "#2d5a3d" },
          modal: {
            ondismiss: () => {
              reject(new Error("Payment cancelled"))
            }
          }
        }

        const rzp = new (window as any).Razorpay(options)
        rzp.on("payment.failed", (resp: any) => {
          reject(new Error(resp.error?.description || "Payment failed"))
        })
        rzp.open()
      })

    } catch (error: any) {
      console.error("Subscribe error:", error)
      toast.error(error.message || "Failed to process subscription")
    } finally {
      setProcessing(false)
      setSelectedPlan(null)
    }
  }

  const getPlanIcon = (duration: number) => {
    if (duration === 3) return <Sparkles className="w-5 h-5" />
    if (duration === 6) return <Zap className="w-5 h-5" />
    return <Crown className="w-5 h-5" />
  }

  const formatPrice = (price: number) => {
    return `₹${price.toFixed(0)}`
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Unlock premium features and take control of your health journey
        </p>

        {/* Current Subscription Banner */}
        {currentSubscription && (
          <div className="max-w-2xl mx-auto mb-8">
            <Card className="border-primary bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Crown className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold">Active Subscription</p>
                      <p className="text-sm text-muted-foreground">
                        {currentSubscription.plan_name} • {currentSubscription.days_remaining} days remaining
                      </p>
                    </div>
                  </div>
                  <Badge variant="default">Premium</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pricing Toggle */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Label htmlFor="pricing-toggle" className={!showMonthly ? "font-semibold" : ""}>
            Full Payment
          </Label>
          <Switch
            id="pricing-toggle"
            checked={showMonthly}
            onCheckedChange={setShowMonthly}
          />
          <Label htmlFor="pricing-toggle" className={showMonthly ? "font-semibold" : ""}>
            Monthly Equivalent
          </Label>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan, index) => {
          const isPopular = plan.badge?.includes("Popular")
          const isBestValue = plan.badge?.includes("Best")
          const isSelected = selectedPlan === plan.id
          const isProcessing = processing && isSelected

          return (
            <Card
              key={plan.id}
              className={`relative transition-all ${
                isBestValue
                  ? "border-primary shadow-xl scale-105 z-10"
                  : isPopular
                  ? "border-orange-500 shadow-lg"
                  : "hover:shadow-lg"
              }`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge
                    variant={isBestValue ? "default" : "secondary"}
                    className={`px-3 py-1 ${
                      isBestValue ? "bg-primary" : "bg-orange-500 text-white"
                    }`}
                  >
                    {plan.badge}
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  {getPlanIcon(plan.duration_months)}
                </div>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.duration_months} months of premium access</CardDescription>
              </CardHeader>

              <CardContent className="text-center">
                {/* Pricing */}
                <div className="mb-6">
                  {!showMonthly ? (
                    <>
                      {plan.discount_amount > 0 && (
                        <p className="text-sm text-muted-foreground line-through mb-1">
                          {formatPrice(plan.base_price)}
                        </p>
                      )}
                      <div className="flex items-baseline justify-center gap-2 mb-2">
                        <span className="text-4xl font-bold">{formatPrice(plan.final_price)}</span>
                        <span className="text-muted-foreground">total</span>
                      </div>
                      {plan.discount_amount > 0 && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Save {formatPrice(plan.discount_amount)}
                        </Badge>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline justify-center gap-2 mb-2">
                        <span className="text-4xl font-bold">
                          {formatPrice(plan.monthly_equivalent)}
                        </span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Billed {formatPrice(plan.final_price)} for {plan.duration_months} months
                      </p>
                    </>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-3 text-left mb-6">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  size="lg"
                  variant={isBestValue ? "default" : "outline"}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={processing || currentSubscription}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : currentSubscription ? (
                    "Current Plan"
                  ) : (
                    "Get Started"
                  )}
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>

      {/* Feature Comparison */}
      <div className="max-w-4xl mx-auto mt-16">
        <h2 className="text-2xl font-bold text-center mb-8">What's Included</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Check className="w-5 h-5 text-primary" />
                  Premium Features
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• AI-Powered Food Analysis</li>
                  <li>• Personalized Diet Plans</li>
                  <li>• Advanced Nutrition Analytics</li>
                  <li>• Meal History & Tracking</li>
                  <li>• Priority Support</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  Always Free
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Water Intake Tracking</li>
                  <li>• Basic Dashboard</li>
                  <li>• Manual Calorie Logging</li>
                  <li>• Profile Management</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto mt-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Questions?</h2>
        <p className="text-muted-foreground mb-4">
          We're here to help! Visit{" "}
          <Link href="/support" className="text-primary underline underline-offset-4">
            Support & Telegram
          </Link>
          {" "}for assistance.
        </p>
        <p className="text-sm text-muted-foreground">
          All plans include a 7-day money-back guarantee
        </p>
      </div>
    </div>
  )
}
