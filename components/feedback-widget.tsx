"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { MessageSquarePlus, X, Loader2, Send } from "lucide-react"
import { cn } from "@/lib/utils"

export function FeedbackWidget() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handleScroll = () => {
      // Hide on scroll
      setIsVisible(false)

      // Show after scroll stops
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
      scrollTimeout.current = setTimeout(() => {
        setIsVisible(true)
      }, 1000)
    }

    const handleInteraction = () => {
      setIsVisible(true)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    window.addEventListener("mousedown", handleInteraction, { passive: true })
    window.addEventListener("touchstart", handleInteraction, { passive: true })

    return () => {
      window.removeEventListener("scroll", handleScroll)
      window.removeEventListener("mousedown", handleInteraction)
      window.removeEventListener("touchstart", handleInteraction)
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!feedback.trim()) return

    setIsSubmitting(true)
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: feedback,
          name: user?.name || "Guest User",
          email: user?.email || "Not logged in"
        }),
      })

      if (response.ok) {
        setSubmitted(true)
        setTimeout(() => {
          setIsOpen(false)
          setTimeout(() => {
            setSubmitted(false)
            setFeedback("")
          }, 300)
        }, 2000)
      }
    } catch (error) {
      console.error("Feedback error:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-24 md:bottom-8 right-6 rounded-full w-14 h-14 shadow-2xl p-0 z-40 transition-all duration-700 ease-in-out",
          "bg-primary hover:bg-primary/90 text-primary-foreground",
          !isVisible && !isOpen ? "translate-x-[75%] opacity-40 scale-90" : "translate-x-0 opacity-100 scale-100"
        )}
        aria-label="Send Feedback"
      >
        <MessageSquarePlus className="w-6 h-6" />
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-background/20 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none sm:p-0">
          <Card className="w-full sm:w-[350px] shadow-2xl border-border animate-in fade-in slide-in-from-bottom-5 sm:fixed sm:bottom-24 sm:right-6 sm:slide-in-from-bottom-10">
            <CardHeader className="relative pb-4">
              <CardTitle className="text-lg font-black uppercase tracking-tight">Send Feedback</CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-widest opacity-40">System Improvement Protocol</CardDescription>
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-foreground rounded-full"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {submitted ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Send className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-black uppercase tracking-tight text-foreground">Transmission Success</h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Feedback logged in central hub.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="feedback" className="sr-only">Feedback</Label>
                    <Textarea 
                      id="feedback"
                      placeholder="Identify systemic optimizations..." 
                      className="min-h-[100px] resize-none rounded-2xl border-white/10"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full rounded-2xl font-black uppercase tracking-widest h-12" disabled={isSubmitting || !feedback.trim()}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Initiate Feedback
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}

