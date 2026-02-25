"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Crown, Sparkles, Lock, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { getApiUrl } from "@/lib/api"

interface PremiumGateProps {
  feature: "food_analyzer" | "diet_planner" | "advanced_analytics"
  children: React.ReactNode
  showBlur?: boolean
}

const FEATURE_INFO = {
  food_analyzer: {
    title: "AI Food Analyzer",
    description: "Upload food images and get instant nutritional analysis powered by AI",
    icon: Sparkles,
    benefits: [
      "Instant food recognition",
      "Accurate calorie counting",
      "Complete nutritional breakdown",
      "Meal logging automation"
    ]
  },
  diet_planner: {
    title: "Personalized Diet Planner",
    description: "Get AI-generated meal plans customized to your goals and preferences",
    icon: Crown,
    benefits: [
      "Custom meal plans",
      "Goal-oriented recommendations",
      "Nutritional balance optimization",
      "Weekly meal schedules"
    ]
  },
  advanced_analytics: {
    title: "Advanced Analytics",
    description: "Deep insights into your nutrition patterns and progress tracking",
    icon: Sparkles,
    benefits: [
      "Detailed nutrition graphs",
      "Progress tracking",
      "Trend analysis",
      "Export reports"
    ]
  }
}

export function PremiumGate({ feature, children, showBlur = true }: PremiumGateProps) {
  const { user, token } = useAuth()
  const router = useRouter()
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (token) {
      checkAccess()
    } else {
      setHasAccess(false)
      setChecking(false)
    }
  }, [feature, token])

  const checkAccess = async () => {
    try {
      const response = await fetch(
        getApiUrl(`/api/subscription/feature-access/${feature}`),
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )

      const data = await response.json()
      setHasAccess(data.has_access)

      // Show modal if no access
      if (!data.has_access) {
        setShowUpgradeModal(true)
      }
    } catch (error) {
      console.error("Failed to check feature access:", error)
      setHasAccess(false)
    } finally {
      setChecking(false)
    }
  }

  const handleUpgrade = () => {
    router.push("/subscription")
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // If user has access, render children normally
  if (hasAccess) {
    return <>{children}</>
  }

  const featureInfo = FEATURE_INFO[feature]
  const Icon = featureInfo.icon

  return (
    <>
      {/* Blurred Content */}
      <div className="relative">
        {showBlur && (
          <div className="absolute inset-0 z-10 backdrop-blur-md bg-background/50 flex items-center justify-center">
            <div className="text-center p-8 max-w-md">
              <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Premium Feature</h3>
              <p className="text-muted-foreground mb-6">
                Upgrade to unlock {featureInfo.title}
              </p>
              <Button onClick={() => setShowUpgradeModal(true)} size="lg">
                <Crown className="w-4 h-4 mr-2" />
                View Plans
              </Button>
            </div>
          </div>
        )}
        
        <div className={showBlur ? "pointer-events-none select-none" : ""}>
          {children}
        </div>
      </div>

      {/* Upgrade Modal */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Icon className="w-8 h-8 text-primary" />
            </div>
            <DialogTitle className="text-center text-2xl">
              Unlock {featureInfo.title}
            </DialogTitle>
            <DialogDescription className="text-center">
              {featureInfo.description}
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            <div className="space-y-3 mb-6">
              <p className="text-sm font-semibold text-muted-foreground">What you'll get:</p>
              {featureInfo.benefits.map((benefit, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <ArrowRight className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm">{benefit}</span>
                </div>
              ))}
            </div>

            <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Premium Plan</p>
                  <p className="text-sm text-muted-foreground">Starting at ₹99/month</p>
                </div>
                <Badge variant="default" className="bg-primary">
                  Best Value
                </Badge>
              </div>
            </div>
          </div>

          <DialogFooter className="sm:justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => setShowUpgradeModal(false)}
              className="flex-1"
            >
              Maybe Later
            </Button>
            <Button onClick={handleUpgrade} className="flex-1">
              <Crown className="w-4 h-4 mr-2" />
              View Plans
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Usage example:
/*
import { PremiumGate } from '@/components/premium-gate'

// In your protected pages:
<PremiumGate feature="food_analyzer">
  <FoodAnalyzer />
</PremiumGate>

<PremiumGate feature="diet_planner">
  <DietPlanner />
</PremiumGate>
*/
