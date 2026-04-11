"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { MessageSquarePlus, X, Loader2, Send } from "lucide-react"

export function FeedbackWidget() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

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
        className="fixed bottom-24 md:bottom-8 right-6 rounded-full w-14 h-14 shadow-lg p-0 z-40 bg-primary hover:bg-primary/90 transition-transform hover:scale-105"
        aria-label="Send Feedback"
      >
        <MessageSquarePlus className="w-6 h-6 text-primary-foreground" />
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-background/20 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none sm:p-0">
          <Card className="w-full sm:w-[350px] shadow-2xl border-border animate-in slide-in-from-bottom-5 sm:fixed sm:bottom-24 sm:right-6 sm:slide-in-from-bottom-10">
            <CardHeader className="relative pb-4">
              <CardTitle className="text-lg">Send Feedback</CardTitle>
              <CardDescription>We'd love to hear your thoughts or bug reports.</CardDescription>
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-foreground"
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
                  <h3 className="font-semibold text-foreground">Thank You!</h3>
                  <p className="text-sm text-muted-foreground">Your feedback has been received.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="feedback" className="sr-only">Feedback</Label>
                    <Textarea 
                      id="feedback"
                      placeholder="What can we improve?" 
                      className="min-h-[100px] resize-none"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting || !feedback.trim()}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Submit Feedback
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
