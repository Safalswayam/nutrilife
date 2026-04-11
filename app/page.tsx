"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowRight, CheckCircle2, Star, Target, Zap, BarChart, Shield, Camera, Leaf, Activity, Sparkles } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background selection:bg-primary/20 overflow-x-hidden">
      
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/40 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex flex-row items-center gap-2 group cursor-pointer">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full group-hover:bg-primary/40 transition-colors"></div>
              <Image src="/nutrilife-icon.png" width={40} height={40} alt="Logo" className="rounded-xl relative z-10 shadow-lg" />
            </div>
            <span className="font-black text-2xl tracking-tighter text-foreground">NutriLife</span>
          </div>
          
          <div className="hidden md:flex items-center gap-10 text-sm font-semibold tracking-wide uppercase text-muted-foreground">
            <Link href="#features" className="hover:text-primary transition-colors">Features</Link>
            <Link href="#testimonials" className="hover:text-primary transition-colors">Testimonials</Link>
            <Link href="#pricing" className="hover:text-primary transition-colors">Pricing</Link>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="font-bold hover:bg-primary/5">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button className="font-bold px-6 bg-primary shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_25px_rgba(var(--primary),0.5)] transition-all">
                Join Now
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
          {/* Background Image with Overlay */}
          <div className="absolute inset-0 z-0">
            <Image 
              src="/healthy-lifestyle-bg.png" 
              alt="Healthy Lifestyle" 
              fill 
              className="object-cover opacity-15 dark:opacity-10 scale-105"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background"></div>
          </div>
          
          <div className="container mx-auto px-6 grid md:grid-cols-2 gap-12 items-center relative z-10">
            <div className="text-left animate-in fade-in slide-in-from-left-8 duration-1000">
              <Badge />
              <h1 className="text-6xl md:text-8xl font-black tracking-tight text-balance mb-8 leading-[0.9] bg-gradient-to-br from-foreground via-foreground to-foreground/50 bg-clip-text text-transparent">
                Your AI <br/>Personal <span className="text-primary">Dietitian.</span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-xl leading-relaxed">
                NutriLife uses cutting-edge AI to scan your meals, track your macros, and curate the perfect diet plan for your unique biology.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <Link href="/signup" className="w-full sm:w-auto">
                  <Button size="lg" className="h-16 px-10 text-xl w-full sm:w-auto shadow-2xl shadow-primary/30 group">
                    Get Started Free <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <div className="flex -space-x-4 items-center">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-background bg-muted flex items-center justify-center overflow-hidden">
                       <div className="w-full h-full bg-primary/20 flex items-center justify-center font-bold text-[10px]">U{i}</div>
                    </div>
                  ))}
                  <span className="ml-4 text-sm font-semibold text-muted font-medium pr-2"></span>
                  <p className="text-sm font-semibold text-muted-foreground">Joined by 2k+ users</p>
                </div>
              </div>
            </div>

            <div className="relative flex justify-center items-center animate-in fade-in slide-in-from-right-8 duration-1000">
              <div className="absolute w-[120%] h-[120%] bg-primary/20 rounded-full blur-[120px] -z-10 animate-pulse"></div>
              <div className="relative group">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-accent/20 rounded-[2.5rem] blur-2xl group-hover:blur-3xl transition-all duration-500"></div>
                <div className="relative bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/10 p-4 shadow-2xl rotate-2 group-hover:rotate-0 transition-transform duration-500">
                  <Image 
                    src="/hero-food-plate.png" 
                    width={500} 
                    height={500} 
                    alt="Healthy Food Plate" 
                    className="rounded-2xl shadow-lg ring-1 ring-white/10 animate-float"
                  />
                  {/* Floating Elements */}
                  <div className="absolute -top-6 -right-6 bg-card/80 backdrop-blur-lg p-4 rounded-2xl border border-border shadow-xl animate-bounce-slow">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                        <Leaf className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-xs font-bold">Nutrient Rich</p>
                        <p className="text-[10px] text-muted-foreground">100% Organic</p>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -bottom-6 -left-6 bg-card/80 backdrop-blur-lg p-4 rounded-2xl border border-border shadow-xl animate-float" style={{animationDelay: '1s'}}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <Activity className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs font-bold">Macro Tracked</p>
                        <p className="text-[10px] text-muted-foreground">450 kcal scanned</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-32 relative overflow-hidden reveal-3d">
          <div className="container mx-auto px-6 relative z-10">
            <div className="text-center mb-24">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent font-bold text-xs uppercase tracking-widest mb-6 border border-accent/20">
                Powerful Capabilities
              </div>
              <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">Everything you need to <span className="text-primary italic">transform.</span></h2>
              <p className="text-muted-foreground text-xl max-w-2xl mx-auto leading-relaxed">
                We've combined advanced AI with nutritional science to give you the ultimate edge in your health journey.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard 
                icon={Camera} 
                title="AI Vision Scanner" 
                desc="Snap a photo of your meal and let our AI do the hard work. It detects ingredients, portions, and macros instantly."
                color="primary"
              />
              <FeatureCard 
                icon={Target} 
                title="Precision Planning" 
                desc="Get diet plans that adapt to your progress. Whether you're bulking or cutting, our AI adjusts your plan in real-time."
                color="blue"
              />
              <FeatureCard 
                icon={BarChart} 
                title="Deep Analytics" 
                desc="Visualize your progress with stunning charts. Track every gram of protein and every drop of water effortlessly."
                color="orange"
              />
            </div>
          </div>
          
          {/* Subtle Background Decoration */}
          <div className="absolute top-1/2 left-0 w-96 h-96 bg-primary/5 blur-[100px] rounded-full"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/5 blur-[100px] rounded-full"></div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="py-32 bg-muted/20 pb-48 reveal-3d">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="flex flex-col md:flex-row items-end justify-between mb-16 gap-8">
              <div className="max-w-2xl">
                <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Loved by enthusiasts.</h2>
                <p className="text-lg text-muted-foreground">Hear from the people who have already changed their lives with NutriLife.</p>
              </div>
              <div className="flex items-center gap-2 bg-background p-4 rounded-2xl border border-border shadow-sm">
                <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
                <span className="font-black text-xl">4.9/5</span>
                <span className="text-muted-foreground text-sm font-semibold">Average Rating</span>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <TestimonialCard 
                name="Sarah Mitchell"
                role="Pro Athlete"
                text="The AI scanner is a game-changer for my prep. I no longer waste hours looking up obscure macros. It's fast, accurate, and essential."
                initials="SM"
              />
              <TestimonialCard 
                name="Rahul Kapoor"
                role="Fitness Enthusiast"
                text="Finding a dietitian that understands Indian cuisine is hard. NutriLife's AI handles it perfectly, giving me customized high-protein plans."
                initials="RK"
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 -mt-24 relative z-20 reveal-3d">
          <div className="container mx-auto px-6">
            <div className="bg-primary rounded-[3rem] p-12 md:p-20 text-center text-primary-foreground relative overflow-hidden shadow-3xl">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent)]"></div>
              <div className="relative z-10 max-w-3xl mx-auto">
                <h2 className="text-5xl md:text-7xl font-black mb-8 leading-tight tracking-tighter">Ready to meet the <br/>new you?</h2>
                <p className="text-xl md:text-2xl opacity-90 mb-12 font-medium">
                  Join thousands of users who have already started their journey. No credit card required.
                </p>
                <Link href="/signup">
                  <Button size="lg" variant="secondary" className="h-16 px-12 text-xl font-bold bg-white text-primary hover:bg-white/90 scale-105 hover:scale-110 transition-transform">
                    Start Your Journey Now
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-border py-20 bg-background relative z-10">
        <div className="container mx-auto px-6 grid md:grid-cols-4 gap-12 text-left mb-20">
          <div className="col-span-2">
           <div className="flex flex-row items-center gap-2 mb-6">
              <Image src="/nutrilife-icon.png" width={32} height={32} alt="Logo" className="rounded-lg" />
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
              <li><Link href="/pricing" className="hover:text-primary transition-all">Pricing</Link></li>
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
        <div className="container mx-auto px-6 pt-12 border-t border-border flex flex-col md:flex-row justify-between items-center gap-6 text-sm font-bold text-muted-foreground">
          <p>© {new Date().getFullYear()} NutriLife AI. Built for excellence.</p>
          <div className="flex items-center gap-8">
            <Link href="#" className="hover:text-primary transition-all">Twitter</Link>
            <Link href="#" className="hover:text-primary transition-all">Instagram</Link>
            <Link href="#" className="hover:text-primary transition-all">LinkedIn</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Badge() {
  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-black text-xs uppercase tracking-widest mb-8 border border-primary/20 animate-pulse">
      <Sparkles className="w-4 h-4" /> 
      <span>Experience NutriLife 2.0</span>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, desc, color }: any) {
  const colorStyles: any = {
    primary: "bg-primary/10 text-primary border-primary/20",
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    orange: "bg-orange-500/10 text-orange-500 border-orange-500/20"
  }
  
  return (
    <div className="group bg-card p-10 rounded-[2.5rem] border border-border shadow-sm hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-2 transition-all duration-500">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-8 ${colorStyles[color]} group-hover:scale-110 transition-transform`}>
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-2xl font-black mb-4 tracking-tight">{title}</h3>
      <p className="text-muted-foreground leading-relaxed font-medium">{desc}</p>
    </div>
  )
}

function TestimonialCard({ name, role, text, initials }: any) {
  return (
    <div className="p-10 rounded-[2.5rem] bg-card border border-border shadow-sm relative overflow-hidden group hover:shadow-xl transition-all">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors"></div>
      <div className="flex gap-1 text-amber-500 mb-8">
        <Star className="w-5 h-5 fill-current"/><Star className="w-5 h-5 fill-current"/><Star className="w-5 h-5 fill-current"/><Star className="w-5 h-5 fill-current"/><Star className="w-5 h-5 fill-current"/>
      </div>
      <p className="text-xl font-bold leading-relaxed mb-10 italic">"{text}"</p>
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center font-black text-primary text-xl shadow-inner">
          {initials}
        </div>
        <div>
          <p className="font-black text-lg">{name}</p>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{role}</p>
        </div>
      </div>
    </div>
  )
}