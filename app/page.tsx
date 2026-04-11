"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowRight, CheckCircle2, Star, Target, Zap, BarChart, Shield, Camera } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background selection:bg-primary/20">
      
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex flex-row items-center gap-2">
            <Image src="/nutrilife-icon.png" width={32} height={32} alt="Logo" className="rounded-lg" />
            <span className="font-bold text-xl tracking-tight">NutriLife</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</Link>
            <Link href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors">Testimonials</Link>
            <Link href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="font-semibold">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button className="font-semibold shadow-lg shadow-primary/20">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="pt-32 pb-20 md:pt-48 md:pb-32 px-6 container mx-auto text-center relative overflow-hidden">
          {/* Background Glows */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[100px] -z-10 opacity-50 pointer-events-none"></div>
          
          <Badge />
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-balance mx-auto mb-8 bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent max-w-4xl leading-[1.1]">
            Your AI-Powered Personal Dietitian.
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto text-balance">
            Stop guessing your macros. NutriLife uses advanced AI to analyze your food, track your goals, and generate personalized diet plans instantly.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="h-14 px-8 text-lg w-full sm:w-auto shadow-2xl shadow-primary/20">
                Start For Free <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg w-full sm:w-auto bg-background/50 backdrop-blur-sm border-border">
                Explore Features
              </Button>
            </Link>
          </div>

          <div className="mt-16 flex items-center justify-center gap-8 flex-wrap opacity-60">
            <div className="flex items-center gap-2 font-medium">
              <Shield className="w-5 h-5" /> Highly Secure
            </div>
            <div className="flex items-center gap-2 font-medium">
              <Star className="w-5 h-5 fill-current text-amber-500" /> 4.9/5 Rating
            </div>
            <div className="flex items-center gap-2 font-medium">
              <Zap className="w-5 h-5 text-primary" /> Instant AI Results
            </div>
          </div>
        </section>

        {/* Value Proposition / Features */}
        <section id="features" className="py-24 bg-muted/30 border-y border-border">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to succeed</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Built-in tools to make tracking effortless and goals achievable.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard 
                icon={Camera} 
                title="AI Food Scanner" 
                desc="Just snap a picture of your meal. Our AI instantly detects the food and calculates calories and macros."
              />
              <FeatureCard 
                icon={Target} 
                title="Smart Diet Plans" 
                desc="Get weekly diet plans tailored to your BMI, goals, and basal metabolic rate."
              />
              <FeatureCard 
                icon={BarChart} 
                title="Advanced Analytics" 
                desc="Track your daily streaks, weight progress, and nutrient breakdowns perfectly."
              />
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section id="testimonials" className="py-24 container mx-auto px-6 max-w-5xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-12">Join 2,000+ healthy users</h2>
          
          <div className="grid md:grid-cols-2 gap-6 text-left">
            <div className="p-8 rounded-2xl bg-card border border-border shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-1 text-amber-500">
                  <Star className="w-5 h-5 fill-current"/><Star className="w-5 h-5 fill-current"/><Star className="w-5 h-5 fill-current"/><Star className="w-5 h-5 fill-current"/><Star className="w-5 h-5 fill-current"/>
                </div>
              </div>
              <p className="text-lg italic mb-6">"The AI food scanner is mind-blowing. I literally just take a photo of my biryani and it logs the exact macros immediately. I've lost 5kg in two months."</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">S</div>
                <div>
                  <p className="font-bold">Sarah M.</p>
                  <p className="text-xs text-muted-foreground">Pro Member</p>
                </div>
              </div>
            </div>
            
            <div className="p-8 rounded-2xl bg-card border border-border shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-1 text-amber-500">
                  <Star className="w-5 h-5 fill-current"/><Star className="w-5 h-5 fill-current"/><Star className="w-5 h-5 fill-current"/><Star className="w-5 h-5 fill-current"/><Star className="w-5 h-5 fill-current"/>
                </div>
              </div>
              <p className="text-lg italic mb-6">"I always struggled with building diet plans. NutriLife gave me a custom high-protein Indian diet that actually fits my lifestyle without feeling restrictive."</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">R</div>
                <div>
                  <p className="font-bold">Rahul K.</p>
                  <p className="text-xs text-muted-foreground">Free Member</p>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-border py-12 text-center text-muted-foreground">
        <p>© {new Date().getFullYear()} NutriLife. All rights reserved.</p>
      </footer>
    </div>
  )
}

function Badge() {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-medium text-sm mb-6 border border-primary/20">
      <SparkleIcon className="w-4 h-4" /> 
      <span>NutriLife 2.0 is here</span>
    </div>
  )
}

function SparkleIcon(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  )
}

function FeatureCard({ icon: Icon, title, desc }: any) {
  return (
    <div className="bg-card p-8 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  )
}