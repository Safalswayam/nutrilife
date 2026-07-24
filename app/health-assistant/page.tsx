"use client"

import React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { getApiUrl } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  MessageCircle,
  Send,
  Loader2,
  User,
  Bot,
  AlertTriangle,
  CheckCircle,
  Stethoscope,
  Pill,
  Shield,
  Info,
  Heart,
  Activity,
  Trash2,
  Download,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Clock,
  Calendar,
  Moon,
  Sun,
  Droplets,
  Brain,
  Dumbbell,
  Apple,
  Zap,
  ChevronRight,
  X,
  HelpCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  severity?: "low" | "medium" | "high"
  shouldConsultDoctor?: boolean
  remedies?: string[]
  preventiveMeasures?: string[]
  detectedSymptoms?: string[]
  followUpQuestions?: string[]
  feedback?: "positive" | "negative" | null
}

interface WellnessData {
  mood: number
  energy: number
  sleep: number
  stress: number
  hydration: number
}

interface SymptomEntry {
  date: Date
  symptoms: string[]
  severity: string
}

const bodyParts = [
  { id: "head", label: "Head", symptoms: ["headache", "dizziness", "migraine", "head pressure"] },
  { id: "throat", label: "Throat", symptoms: ["sore throat", "difficulty swallowing", "throat pain"] },
  { id: "chest", label: "Chest", symptoms: ["chest pain", "chest tightness", "breathing difficulty", "heart palpitations"] },
  { id: "stomach", label: "Stomach", symptoms: ["stomach pain", "nausea", "bloating", "indigestion", "cramps"] },
  { id: "back", label: "Back", symptoms: ["back pain", "lower back pain", "upper back pain", "spine discomfort"] },
  { id: "joints", label: "Joints", symptoms: ["joint pain", "knee pain", "shoulder pain", "arthritis", "stiffness"] },
  { id: "skin", label: "Skin", symptoms: ["rash", "itching", "hives", "dry skin", "skin irritation"] },
  { id: "general", label: "General", symptoms: ["fatigue", "fever", "weakness", "chills", "weight changes"] },
]

const symptomCategories = [
  {
    category: "Common Issues",
    icon: Activity,
    symptoms: ["I have a headache", "I feel tired", "I have a cold", "My throat hurts"],
  },
  {
    category: "Digestive",
    icon: Apple,
    symptoms: ["Stomach ache", "Feeling nauseous", "Bloating", "Indigestion"],
  },
  {
    category: "Mental Health",
    icon: Brain,
    symptoms: ["Feeling anxious", "Trouble sleeping", "Feeling stressed", "Low mood"],
  },
  {
    category: "Pain",
    icon: Zap,
    symptoms: ["Back pain", "Joint pain", "Muscle soreness", "Neck stiffness"],
  },
]

const wellnessQuestions = [
  { key: "mood", label: "How is your mood today?", icon: Heart, lowLabel: "Low", highLabel: "Great" },
  { key: "energy", label: "How are your energy levels?", icon: Zap, lowLabel: "Exhausted", highLabel: "Energetic" },
  { key: "sleep", label: "How did you sleep last night?", icon: Moon, lowLabel: "Poorly", highLabel: "Very well" },
  { key: "stress", label: "How stressed are you feeling?", icon: Brain, lowLabel: "Very stressed", highLabel: "Relaxed" },
  { key: "hydration", label: "How well hydrated are you?", icon: Droplets, lowLabel: "Dehydrated", highLabel: "Well hydrated" },
]

// ── Time-aware greeting helpers ────────────────────────────────────────────
function getTimeGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return "Good morning"
  if (hour >= 12 && hour < 17) return "Good afternoon"
  if (hour >= 17 && hour < 21) return "Good evening"
  return "Good night"
}

function getTodayString(): string {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function getTimeBasedHealthTip(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 9) return "Morning tip: Start with a glass of warm water and light stretching."
  if (hour >= 9 && hour < 12) return "Mid-morning: A healthy snack can keep your energy steady."
  if (hour >= 12 && hour < 14) return "Lunchtime: Eat mindfully and include protein and vegetables."
  if (hour >= 14 && hour < 17) return "Afternoon: Stay hydrated — drink water before you feel thirsty."
  if (hour >= 17 && hour < 20) return "Evening: A short walk after dinner aids digestion."
  if (hour >= 20 && hour < 22) return "Wind-down time: Avoid screens and heavy meals before bed."
  return "Late night: Rest is important — try to get to sleep soon."
}
// ──────────────────────────────────────────────────────────────────────────

export default function HealthAssistantPage() {
  const _greeting = getTimeGreeting()
  const _today = getTodayString()
  const _healthTip = getTimeBasedHealthTip()

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        `${_greeting}! Today is ${_today}.\n\n${_healthTip}\n\nI'm your AI Health Assistant. I can help you understand symptoms, suggest home remedies, and advise whether you should consult a doctor.\n\nYou can describe your symptoms, select from common issues, or do a quick wellness check-in. How can I help you today?`,
      timestamp: new Date(),
      followUpQuestions: [
        "Do a wellness check-in",
        "I want to track a symptom",
        "Tell me about healthy habits",
        "What symptoms require immediate attention?",
      ],
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null)
  const [showBodySelector, setShowBodySelector] = useState(false)
  const [showWellnessCheck, setShowWellnessCheck] = useState(false)
  const [wellnessStep, setWellnessStep] = useState(0)
  const [wellnessData, setWellnessData] = useState<WellnessData>({
    mood: 50,
    energy: 50,
    sleep: 50,
    stress: 50,
    hydration: 50,
  })
  const [symptomHistory, setSymptomHistory] = useState<SymptomEntry[]>([])
  const [activeTab, setActiveTab] = useState("chat")
  const [symptomDuration, setSymptomDuration] = useState<string>("")
  const [showDurationDialog, setShowDurationDialog] = useState(false)
  const [pendingSymptom, setPendingSymptom] = useState<string>("")

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const simulateTyping = async (duration: number = 1500) => {
    setIsTyping(true)
    await new Promise((resolve) => setTimeout(resolve, duration))
    setIsTyping(false)
  }

  const sendMessage = async (messageText?: string, includeContext?: string) => {
    const text = messageText || input.trim()
    if (!text || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    await simulateTyping()

    try {
      const contextEnhancedMessage = includeContext
        ? `${text}. Additional context: ${includeContext}`
        : text

      console.log("[v0] Health chat request to:", getApiUrl("/api/health-chat"))
      const response = await fetch(getApiUrl("/api/health-chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: contextEnhancedMessage,
          history: messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      console.log("[v0] Health chat response status:", response.status)
      console.log("[v0] Response headers:", response.headers.get("content-type"))

      let data
      const contentType = response.headers.get("content-type")

      try {
        if (contentType?.includes("application/json")) {
          data = await response.json()
        } else {
          const text = await response.text()
          console.error("[v0] Response is not JSON. Got:", contentType)
          console.error("[v0] Response body:", text.substring(0, 500))

          throw new Error(
            `API Error: Expected JSON response but got ${contentType || 'unknown type'}. ` +
            `This usually means:\n` +
            `1. The backend API is not running (check if FastAPI server is running on port 8000)\n` +
            `2. The API URL is incorrect (check NEXT_PUBLIC_API_URL in .env.local)\n` +
            `3. There's a network issue preventing connection to the backend\n\n` +
            `Response preview: ${text.substring(0, 200)}`
          )
        }
      } catch (parseError) {
        console.error("[v0] JSON parse error:", parseError)
        throw new Error("Could not parse API response. Backend server may not be running correctly.")
      }

      console.log("[v0] Health chat response data:", data)

      if (!response.ok) {
        console.error("[v0] API Error:", data.detail || data)
        throw new Error(data.detail || "Failed to get response")
      }

      const symptomAnalysis = data.symptom_analysis

      // Generate contextual follow-up questions
      const followUps = generateFollowUpQuestions(symptomAnalysis, text)

      // Track symptoms in history
      if (symptomAnalysis?.detected_symptoms?.length > 0) {
        setSymptomHistory((prev) => [
          ...prev,
          {
            date: new Date(),
            symptoms: symptomAnalysis.detected_symptoms,
            severity: symptomAnalysis.severity,
          },
        ])
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        severity: symptomAnalysis?.severity,
        shouldConsultDoctor: symptomAnalysis?.should_consult_doctor,
        remedies: symptomAnalysis?.remedies,
        preventiveMeasures: symptomAnalysis?.preventive_measures,
        detectedSymptoms: symptomAnalysis?.detected_symptoms,
        followUpQuestions: followUps,
        feedback: null,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error("[v0] Health chat error:", error)

      let errorContent = ""

      if (error instanceof TypeError && error.message === "Failed to fetch") {
        errorContent = "Unable to connect to the health assistant service. Please make sure the backend server is running on http://localhost:8000. You can start it with: uvicorn api.index:app --reload"
      } else if (error instanceof Error) {
        errorContent = `Error: ${error.message}`
      } else {
        errorContent = "I apologize, but I encountered an error. Please try again or rephrase your question."
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: errorContent,
        timestamp: new Date(),
        followUpQuestions: ["Try again", "Ask a different question"],
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const generateFollowUpQuestions = (symptomAnalysis: { severity?: string; detected_symptoms?: string[] } | null, userMessage: string): string[] => {
    const questions: string[] = []

    if (symptomAnalysis?.detected_symptoms?.length) {
      questions.push("How long have you had these symptoms?")
      questions.push("Are symptoms getting better or worse?")

      if (symptomAnalysis.severity === "medium" || symptomAnalysis.severity === "high") {
        questions.push("Have you taken any medication?")
        questions.push("Do you have any other symptoms?")
      }
    }

    if (userMessage.toLowerCase().includes("pain")) {
      questions.push("Can you rate your pain from 1-10?")
      questions.push("Is the pain constant or intermittent?")
    }

    if (questions.length === 0) {
      questions.push("Would you like diet recommendations?")
      questions.push("Tell me about your sleep habits")
      questions.push("What other concerns do you have?")
    }

    return questions.slice(0, 4)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleBodyPartSelect = (partId: string) => {
    const part = bodyParts.find((p) => p.id === partId)
    if (part) {
      setSelectedBodyPart(partId)
      setShowBodySelector(false)

      const symptomList = part.symptoms.slice(0, 3).join(", ")
      sendMessage(
        `I'm experiencing issues with my ${part.label.toLowerCase()}`,
        `Common symptoms in this area include: ${symptomList}`
      )
    }
  }

  const handleSymptomWithDuration = (symptom: string) => {
    setPendingSymptom(symptom)
    setShowDurationDialog(true)
  }

  const submitSymptomWithDuration = () => {
    if (pendingSymptom && symptomDuration) {
      sendMessage(pendingSymptom, `Duration: ${symptomDuration}`)
      setShowDurationDialog(false)
      setSymptomDuration("")
      setPendingSymptom("")
    } else if (pendingSymptom) {
      sendMessage(pendingSymptom)
      setShowDurationDialog(false)
      setPendingSymptom("")
    }
  }

  const handleWellnessComplete = () => {
    setShowWellnessCheck(false)
    setWellnessStep(0)

    const avgScore = Object.values(wellnessData).reduce((a, b) => a + b, 0) / 5
    let assessment = ""
    let recommendations: string[] = []

    if (avgScore >= 70) {
      assessment = "Great news! Your overall wellness looks good today."
      recommendations = [
        "Keep up your healthy habits!",
        "Consider sharing your routine with others",
        "Try a new wellness activity to maintain momentum",
      ]
    } else if (avgScore >= 40) {
      assessment = "Your wellness is moderate. There's room for improvement in some areas."

      if (wellnessData.sleep < 50) recommendations.push("Focus on improving your sleep quality")
      if (wellnessData.stress > 50) recommendations.push("Try stress-relief techniques like deep breathing")
      if (wellnessData.hydration < 50) recommendations.push("Drink more water throughout the day")
      if (wellnessData.energy < 50) recommendations.push("Consider light exercise to boost energy")
    } else {
      assessment = "It seems like you're having a challenging day. Let's work on improving your well-being."
      recommendations = [
        "Take some time for self-care today",
        "Consider speaking with someone about how you're feeling",
        "Start with small, achievable wellness goals",
      ]
    }

    const wellnessMessage: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: `**Wellness Check-In Results**\n\n${assessment}\n\n**Your Scores:**\n- Mood: ${wellnessData.mood}%\n- Energy: ${wellnessData.energy}%\n- Sleep: ${wellnessData.sleep}%\n- Stress Management: ${wellnessData.stress}%\n- Hydration: ${wellnessData.hydration}%\n\n**Recommendations:**\n${recommendations.map((r) => `- ${r}`).join("\n")}`,
      timestamp: new Date(),
      followUpQuestions: [
        "How can I improve my sleep?",
        "Give me stress relief tips",
        "What should I eat for more energy?",
        "How much water should I drink?",
      ],
    }

    setMessages((prev) => [...prev, wellnessMessage])
  }

  const handleFeedback = (messageId: string, feedback: "positive" | "negative") => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, feedback } : msg))
    )
  }

  const clearConversation = () => {
    const newGreeting = getTimeGreeting()
    const newToday = getTodayString()
    const newHealthTip = getTimeBasedHealthTip()
    setMessages([
      {
        id: "welcome-new",
        role: "assistant",
        content: `${newGreeting}! Today is ${newToday}.\n\n${newHealthTip}\n\nConversation cleared. How can I help you today?`,
        timestamp: new Date(),
        followUpQuestions: [
          "Do a wellness check-in",
          "I have a symptom to discuss",
          "Tell me about healthy habits",
        ],
      },
    ])
  }

  const exportConversation = () => {
    const conversationText = messages
      .map((m) => `[${m.role.toUpperCase()}] ${m.timestamp.toLocaleString()}\n${m.content}`)
      .join("\n\n---\n\n")

    const blob = new Blob([conversationText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `health-conversation-${new Date().toISOString().split("T")[0]}.txt`
    a.click()
  }

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case "high":
        return "bg-destructive/10 border-destructive/30 text-destructive"
      case "medium":
        return "bg-accent/10 border-accent/30 text-accent-foreground"
      default:
        return "bg-primary/10 border-primary/30 text-primary"
    }
  }

  const getWellnessColor = (value: number) => {
    if (value >= 70) return "text-primary"
    if (value >= 40) return "text-accent"
    return "text-destructive"
  }

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <PageHeader
        title="Health Assistant"
        subtitle="Ask anything about food, symptoms, or how to make a plan work."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="wellness" className="flex items-center gap-2">
            <Heart className="w-4 h-4" />
            Wellness
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Chat Area */}
            <Card className="lg:col-span-3 h-[800px] flex flex-col border-none glass-card rounded-[2.5rem] overflow-hidden reveal-3d">
              <CardHeader className="pb-4 border-b border-white/5 flex-shrink-0 bg-white/5">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-widest">
                    <div className="p-2.5 rounded-2xl bg-primary/20">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    Health Assistant
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={exportConversation}
                      title="Export conversation"
                      className="hover:bg-white/10 rounded-xl"
                    >
                      <Download className="w-5 h-5 opacity-60" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-4",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {/* Avatar */}
                    <div
                      className={cn(
                        "flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center shadow-2xl glass-card",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground border-none"
                          : "bg-white/5 text-primary border-white/10"
                      )}
                    >
                      {message.role === "user" ? (
                        <User className="w-5 h-5" />
                      ) : (
                        <Bot className="w-5 h-5" />
                      )}
                    </div>

                    {/* Message Content */}
                    <div
                      className={cn(
                        "flex flex-col max-w-[80%]",
                        message.role === "user" ? "items-end" : "items-start"
                      )}
                    >
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-3 shadow-sm",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-card border border-border text-foreground rounded-tl-sm"
                        )}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {message.content}
                        </p>
                      </div>

                      {/* Assistant Message Extras */}
                      {message.role === "assistant" && (
                        <div className="mt-3 space-y-3 w-full">
                          {/* Severity Indicator */}
                          {message.severity && (
                            <div
                              className={cn(
                                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border",
                                getSeverityColor(message.severity)
                              )}
                            >
                              {message.severity === "high" ? (
                                <AlertTriangle className="w-3 h-3" />
                              ) : (
                                <Info className="w-3 h-3" />
                              )}
                              {message.severity === "high"
                                ? "Requires Attention"
                                : message.severity === "medium"
                                  ? "Moderate Concern"
                                  : "Low Concern"}
                            </div>
                          )}

                          {/* Doctor Consultation Alert */}
                          {message.shouldConsultDoctor && (
                            <Alert className="bg-accent/10 border-accent/30">
                              <Stethoscope className="w-4 h-4 text-accent" />
                              <AlertDescription className="text-sm text-foreground">
                                Based on your symptoms, we recommend consulting a healthcare
                                professional.
                              </AlertDescription>
                            </Alert>
                          )}

                          {/* Detected Symptoms */}
                          {message.detectedSymptoms && message.detectedSymptoms.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {message.detectedSymptoms.map((symptom, index) => (
                                <span
                                  key={index}
                                  className="px-3 py-1 text-xs rounded-full bg-muted text-muted-foreground border border-border"
                                >
                                  {symptom}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Remedies */}
                          {message.remedies && message.remedies.length > 0 && (
                            <div className="bg-card border border-border rounded-xl p-4">
                              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                <Pill className="w-4 h-4 text-primary" />
                                Suggested Remedies
                              </h4>
                              <ul className="space-y-2">
                                {message.remedies.slice(0, 4).map((remedy, index) => (
                                  <li
                                    key={index}
                                    className="text-sm text-muted-foreground flex items-start gap-2"
                                  >
                                    <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                    {remedy}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Preventive Measures */}
                          {message.preventiveMeasures && message.preventiveMeasures.length > 0 && (
                            <div className="bg-card border border-border rounded-xl p-4">
                              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                <Shield className="w-4 h-4 text-primary" />
                                Prevention Tips
                              </h4>
                              <ul className="space-y-2">
                                {message.preventiveMeasures.slice(0, 3).map((measure, index) => (
                                  <li
                                    key={index}
                                    className="text-sm text-muted-foreground flex items-start gap-2"
                                  >
                                    <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                    {measure}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Follow-up Questions */}
                          {message.followUpQuestions && message.followUpQuestions.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {message.followUpQuestions.map((question, index) => (
                                <Button
                                  key={index}
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-8 bg-transparent hover:bg-primary/10 hover:text-primary transition-colors"
                                  onClick={() => {
                                    if (question === "Do a wellness check-in") {
                                      setShowWellnessCheck(true)
                                    } else {
                                      sendMessage(question)
                                    }
                                  }}
                                >
                                  {question}
                                  <ChevronRight className="w-3 h-3 ml-1" />
                                </Button>
                              ))}
                            </div>
                          )}

                          {/* Feedback Buttons */}
                          {message.id !== "welcome" && message.id !== "welcome-new" && (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-muted-foreground">Was this helpful?</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  "w-7 h-7",
                                  message.feedback === "positive" && "bg-primary/10 text-primary"
                                )}
                                onClick={() => handleFeedback(message.id, "positive")}
                              >
                                <ThumbsUp className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  "w-7 h-7",
                                  message.feedback === "negative" && "bg-destructive/10 text-destructive"
                                )}
                                onClick={() => handleFeedback(message.id, "negative")}
                              >
                                <ThumbsDown className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      <span className="text-xs text-muted-foreground mt-1">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Typing Indicator */}
                {(isLoading || isTyping) && (
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shadow-sm">
                      <Bot className="w-5 h-5 text-primary" />
                    </div>
                    <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-8 border-t border-white/5 flex-shrink-0 space-y-4 bg-white/5">
                {/* Quick Action Buttons */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none no-scrollbar">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0 glass-card border-white/10 rounded-xl"
                    onClick={() => setShowBodySelector(true)}
                  >
                    <Activity className="w-4 h-4 mr-2 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Map Discomfort</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0 glass-card border-white/10 rounded-xl"
                    onClick={() => setShowWellnessCheck(true)}
                  >
                    <Heart className="w-4 h-4 mr-2 text-destructive" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Wellness Check</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0 glass-card border-white/10 rounded-xl"
                    onClick={() => sendMessage("What are some healthy habits I should follow?")}
                  >
                    <Dumbbell className="w-4 h-4 mr-2 text-[color:var(--info)]" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Habit Protocols</span>
                  </Button>
                </div>

                {/* Nutrition-focused quick-ask prompts for new users */}
                {messages.length <= 1 && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-60">Strategic Queries</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "What should I eat for breakfast today?",
                        "How many calories do I need to lose 5kg?",
                        "What foods are high in protein?",
                        "Is intermittent fasting right for me?",
                        "How much water should I drink daily?",
                        "Best post-workout meal ideas?",
                      ].map((prompt) => (
                        <Button
                          key={prompt}
                          variant="outline"
                          size="sm"
                          className="text-[10px] h-8 rounded-full border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20 font-bold transition-all"
                          onClick={() => sendMessage(prompt)}
                        >
                          {prompt}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe symptoms or query intelligence..."
                    disabled={isLoading}
                    className="flex-1 h-14 rounded-2xl glass-card border-white/10 pl-6 text-sm font-medium"
                  />
                  <Button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || isLoading}
                    size="icon"
                    className="w-14 h-14 rounded-2xl shadow-3xl shadow-primary/20"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Sidebar */}
            <div className="space-y-8 reveal-3d">
              {/* Symptom Categories */}
              <Card className="border-none glass-card rounded-[2rem] overflow-hidden">
                <CardHeader className="p-6 pb-2">
                  <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2 opacity-60">
                    <HelpCircle className="w-4 h-4 text-primary" />
                    Neural Mapping
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-2 space-y-6">
                  {symptomCategories.map((category) => (
                    <div key={category.category} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <category.icon className="w-3.5 h-3.5 text-primary opacity-60" />
                        <span className="text-xs font-black uppercase tracking-widest opacity-40">{category.category}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {category.symptoms.map((symptom) => (
                          <Button
                            key={symptom}
                            variant="outline"
                            size="sm"
                            className="text-[10px] h-7 rounded-lg border-white/5 bg-white/5 hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all font-bold"
                            onClick={() => handleSymptomWithDuration(symptom)}
                            disabled={isLoading}
                          >
                            {symptom}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Disclaimer */}
              <Card className="border-none glass-card rounded-[1.5rem] bg-[color:var(--warning)]/5">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <Info className="w-4 h-4 text-[color:var(--warning)] mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] font-medium text-[color:var(--warning)]/80 leading-relaxed uppercase tracking-widest">
                      Protocol: AI Diagnostics are for architectural reference only. Not a medical substitute.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="wellness" className="mt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 reveal-3d">
            <Card className="border-none glass-card rounded-[2.5rem] overflow-hidden">
              <CardHeader className="p-8 pb-4">
                <CardTitle className="text-xl font-black flex items-center gap-3">
                  <Heart className="w-5 h-5 text-destructive" />
                  Vitality Matrix
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-8">
                {wellnessQuestions.map((q) => {
                  const value = wellnessData[q.key as keyof WellnessData]
                  return (
                    <div key={q.key} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2 rounded-xl bg-white/5", getWellnessColor(value).replace("text-", "bg-").replace("-600", "/10"))}>
                            <q.icon className={cn("w-4 h-4", getWellnessColor(value))} />
                          </div>
                          <span className="text-sm font-black uppercase tracking-widest opacity-60">{q.label.split("?")[0]}</span>
                        </div>
                        <span className={cn("text-lg font-black", getWellnessColor(value))}>
                          {value}%
                        </span>
                      </div>
                      <Slider
                        value={[value]}
                        onValueChange={(val) =>
                          setWellnessData((prev) => ({ ...prev, [q.key]: val[0] }))
                        }
                        max={100}
                        step={5}
                        className="cursor-pointer"
                      />
                    </div>
                  )
                })}
                <Button className="w-full h-14 rounded-2xl text-lg font-black shadow-3xl shadow-primary/20" onClick={handleWellnessComplete}>
                  <Sparkles className="w-5 h-5 mr-3" />
                  Analyze Wellness State
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none glass-card rounded-[2.5rem] overflow-hidden">
              <CardHeader className="p-8 pb-4">
                <CardTitle className="text-xl font-black flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-primary" />
                  Intelligence Briefings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-4">
                {[
                  { icon: Sun, title: "Morning Protocol", tip: "Initiate metabolic activation with somatic stretching" },
                  { icon: Droplets, title: "Hydration Sync", tip: "Maintain 2.5L systemic fluid homeostasis" },
                  { icon: Apple, title: "Nutrient Density", tip: "Optimize micronutrient absorption with polymorphic vegetables" },
                  { icon: Moon, title: "Nocturnal Reset", tip: "Enforce 8h deep-cycle cellular restoration" },
                  { icon: Brain, title: "Neural Calm", tip: "Execute 10m cognitive divergence protocols" },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-4 p-5 rounded-[1.5rem] bg-white/5 hover:bg-white/10 transition-all cursor-pointer border border-white/5 reveal-3d"
                    onClick={() => sendMessage(`Tell me more about ${item.title.toLowerCase()}`)}
                  >
                    <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-widest mb-1">{item.title}</h4>
                      <p className="text-xs font-medium text-muted-foreground leading-relaxed">{item.tip}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-8">
          <Card className="border-none glass-card rounded-[2.5rem] overflow-hidden reveal-3d">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-xl font-black flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary" />
                Diagnostic Archives
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0">
              {symptomHistory.length === 0 ? (
                <div className="text-center py-16 opacity-40">
                  <Activity className="w-16 h-16 mx-auto mb-4" />
                  <p className="font-black uppercase tracking-widest text-[10px]">No Neural Logs Detected</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {symptomHistory
                    .slice()
                    .reverse()
                    .map((entry, index) => (
                      <div
                        key={index}
                        className="p-6 rounded-[2rem] border border-white/5 bg-white/5 hover:bg-white/10 transition-all reveal-3d"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Timestamp</span>
                            <span className="text-xs font-bold font-mono">
                              {entry.date.toLocaleDateString()} · {entry.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full",
                              getSeverityColor(entry.severity).includes("red") ? "bg-destructive/10 text-destructive" :
                                getSeverityColor(entry.severity).includes("yellow") ? "bg-[color:var(--warning)]/10 text-[color:var(--warning)]" :
                                  "bg-primary/10 text-primary"
                            )}
                          >
                            {entry.severity} Severity
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {entry.symptoms.map((symptom, i) => (
                            <span
                              key={i}
                              className="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg bg-white/5 border border-white/5 text-foreground"
                            >
                              {symptom}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Body Part Selector Dialog */}
      <Dialog open={showBodySelector} onOpenChange={setShowBodySelector}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Where are you feeling discomfort?
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {bodyParts.map((part) => (
              <Button
                key={part.id}
                variant="outline"
                className={cn(
                  "h-auto py-4 flex flex-col items-center gap-2 bg-transparent hover:bg-primary/10 hover:border-primary transition-all",
                  selectedBodyPart === part.id && "bg-primary/10 border-primary"
                )}
                onClick={() => handleBodyPartSelect(part.id)}
              >
                <span className="font-medium">{part.label}</span>
                <span className="text-xs text-muted-foreground text-center">
                  {part.symptoms.slice(0, 2).join(", ")}
                </span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Wellness Check Dialog */}
      <Dialog open={showWellnessCheck} onOpenChange={setShowWellnessCheck}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              Quick Wellness Check-In
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <div className="mb-4">
              <Progress value={(wellnessStep + 1) * 20} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                Question {wellnessStep + 1} of 5
              </p>
            </div>

            {wellnessQuestions[wellnessStep] && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {(() => {
                    const IconComponent = wellnessQuestions[wellnessStep].icon
                    return <IconComponent className="w-6 h-6 text-primary" />
                  })()}
                  <h3 className="text-lg font-medium">
                    {wellnessQuestions[wellnessStep].label}
                  </h3>
                </div>

                <Slider
                  value={[
                    wellnessData[
                    wellnessQuestions[wellnessStep].key as keyof WellnessData
                    ],
                  ]}
                  onValueChange={(val) =>
                    setWellnessData((prev) => ({
                      ...prev,
                      [wellnessQuestions[wellnessStep].key]: val[0],
                    }))
                  }
                  max={100}
                  step={5}
                  className="cursor-pointer"
                />

                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{wellnessQuestions[wellnessStep].lowLabel}</span>
                  <span className="font-bold text-primary">
                    {
                      wellnessData[
                      wellnessQuestions[wellnessStep].key as keyof WellnessData
                      ]
                    }
                    %
                  </span>
                  <span>{wellnessQuestions[wellnessStep].highLabel}</span>
                </div>
              </div>
            )}

            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={() => setWellnessStep((s) => Math.max(0, s - 1))}
                disabled={wellnessStep === 0}
                className="bg-transparent"
              >
                Previous
              </Button>
              {wellnessStep < 4 ? (
                <Button onClick={() => setWellnessStep((s) => s + 1)}>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleWellnessComplete}>
                  <Sparkles className="w-4 h-4 mr-1" />
                  Get Results
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Duration Dialog */}
      <Dialog open={showDurationDialog} onOpenChange={setShowDurationDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>How long have you had this symptom?</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {[
              "Just started",
              "A few hours",
              "1-2 days",
              "3-7 days",
              "1-2 weeks",
              "More than 2 weeks",
            ].map((duration) => (
              <Button
                key={duration}
                variant="outline"
                size="sm"
                className={cn(
                  "bg-transparent",
                  symptomDuration === duration && "bg-primary/10 border-primary"
                )}
                onClick={() => setSymptomDuration(duration)}
              >
                {duration}
              </Button>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => {
                setShowDurationDialog(false)
                setSymptomDuration("")
                setPendingSymptom("")
              }}
            >
              Skip
            </Button>
            <Button className="flex-1" onClick={submitSymptomWithDuration}>
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}