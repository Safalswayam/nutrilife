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
  if (hour >= 5  && hour < 12) return "Good morning"
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
  if (hour >= 5  && hour < 9)  return "☀️ Morning tip: Start with a glass of warm water and light stretching."
  if (hour >= 9  && hour < 12) return "🍎 Mid-morning: A healthy snack can keep your energy steady."
  if (hour >= 12 && hour < 14) return "🍱 Lunchtime: Eat mindfully and include protein and vegetables."
  if (hour >= 14 && hour < 17) return "💧 Afternoon: Stay hydrated — drink water before you feel thirsty."
  if (hour >= 17 && hour < 20) return "🚶 Evening: A short walk after dinner aids digestion."
  if (hour >= 20 && hour < 22) return "🌙 Wind-down time: Avoid screens and heavy meals before bed."
  return "😴 Late night: Rest is important — try to get to sleep soon."
}
// ──────────────────────────────────────────────────────────────────────────

export default function HealthAssistantPage() {
  const _greeting   = getTimeGreeting()
  const _today      = getTodayString()
  const _healthTip  = getTimeBasedHealthTip()

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        `${_greeting}! 👋 Today is ${_today}.\n\n${_healthTip}\n\nI'm your AI Health Assistant. I can help you understand symptoms, suggest home remedies, and advise whether you should consult a doctor.\n\nYou can describe your symptoms, select from common issues, or do a quick wellness check-in. How can I help you today?`,
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
    const newGreeting   = getTimeGreeting()
    const newToday      = getTodayString()
    const newHealthTip  = getTimeBasedHealthTip()
    setMessages([
      {
        id: "welcome-new",
        role: "assistant",
        content: `${newGreeting}! 👋 Today is ${newToday}.\n\n${newHealthTip}\n\nConversation cleared. How can I help you today?`,
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
        subtitle="Your interactive wellness companion for symptoms, remedies, and health guidance"
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

<TabsContent value="chat" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Main Chat Area */}
            <Card className="lg:col-span-3 flex flex-col h-[calc(100dvh-160px)] min-h-[800px]">
              <CardHeader className="pb-3 border-b border-border flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 rounded-full bg-primary/10">
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
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearConversation}
                      title="Clear conversation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    {/* Avatar */}
                    <div
                      className={cn(
                        "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-gradient-to-br from-primary/20 to-accent/20 text-primary"
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
              </CardContent>

              {/* Input Area */}
              <div className="p-4 border-t border-border flex-shrink-0 space-y-3">
                {/* Quick Action Buttons */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0 bg-transparent"
                    onClick={() => setShowBodySelector(true)}
                  >
                    <Activity className="w-4 h-4 mr-1" />
                    Body Map
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0 bg-transparent"
                    onClick={() => setShowWellnessCheck(true)}
                  >
                    <Heart className="w-4 h-4 mr-1" />
                    Wellness Check
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0 bg-transparent"
                    onClick={() => sendMessage("What are some healthy habits I should follow?")}
                  >
                    <Dumbbell className="w-4 h-4 mr-1" />
                    Healthy Tips
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe your symptoms or ask a health question..."
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || isLoading}
                    size="icon"
                    className="shadow-lg"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Symptom Categories */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-primary" />
                    Quick Symptoms
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {symptomCategories.map((category) => (
                    <div key={category.category}>
                      <div className="flex items-center gap-2 mb-2">
                        <category.icon className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">{category.category}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {category.symptoms.map((symptom) => (
                          <Button
                            key={symptom}
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 bg-muted/50 hover:bg-primary/10 hover:text-primary"
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
              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      This assistant provides general health information only. It is not a
                      substitute for professional medical advice, diagnosis, or treatment.
                      Always consult a healthcare provider for medical concerns.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="wellness" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-primary" />
                  Today&apos;s Wellness
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {wellnessQuestions.map((q) => {
                  const value = wellnessData[q.key as keyof WellnessData]
                  return (
                    <div key={q.key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <q.icon className={cn("w-4 h-4", getWellnessColor(value))} />
                          <span className="text-sm font-medium">{q.label.split("?")[0]}</span>
                        </div>
                        <span className={cn("text-sm font-bold", getWellnessColor(value))}>
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
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{q.lowLabel}</span>
                        <span>{q.highLabel}</span>
                      </div>
                    </div>
                  )
                })}
                <Button className="w-full mt-4" onClick={handleWellnessComplete}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Get Wellness Insights
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Wellness Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { icon: Sun, title: "Morning Routine", tip: "Start with 5 minutes of stretching" },
                  { icon: Droplets, title: "Stay Hydrated", tip: "Drink 8 glasses of water daily" },
                  { icon: Apple, title: "Eat Colorful", tip: "Include 5 servings of fruits & veggies" },
                  { icon: Moon, title: "Quality Sleep", tip: "Aim for 7-9 hours each night" },
                  { icon: Brain, title: "Mental Health", tip: "Practice 10 mins of mindfulness" },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => sendMessage(`Tell me more about ${item.title.toLowerCase()}`)}
                  >
                    <div className="p-2 rounded-full bg-primary/10">
                      <item.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">{item.title}</h4>
                      <p className="text-xs text-muted-foreground">{item.tip}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Symptom History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {symptomHistory.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No symptoms tracked yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your symptom history will appear here as you chat
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {symptomHistory
                    .slice()
                    .reverse()
                    .map((entry, index) => (
                      <div
                        key={index}
                        className="p-4 rounded-lg border border-border bg-card"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">
                            {entry.date.toLocaleDateString()} at{" "}
                            {entry.date.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span
                            className={cn(
                              "text-xs px-2 py-1 rounded-full",
                              getSeverityColor(entry.severity)
                            )}
                          >
                            {entry.severity}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {entry.symptoms.map((symptom, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 text-xs rounded-full bg-muted text-foreground"
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