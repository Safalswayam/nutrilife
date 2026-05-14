import React from "react"
import type { Metadata, Viewport } from 'next'
import { Poppins, Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from '@/lib/auth-context'
import { AppShell } from '@/components/app-shell'
import './globals.css'

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://nutrilife-h6uw.vercel.app"),
  title: {
    default: "NutriLife - AI Nutrition Assistant",
    template: "%s | NutriLife",
  },
  applicationName: "NutriLife",
  description:
    "Revolutionize your health with NutriLife, the AI-powered nutrition assistant. Track calories instantly, analyze meals with advanced AI, and receive personalized, science-backed diet plans for a healthier lifestyle.",

  keywords: [
    "AI Nutrition",
    "Smart Meal Planner",
    "Health Assistant",
    "Nutrition Tracker",
    "NutriLife",
    "NutriLife AI",
    "NutriLife App",
    "NutriLife Health",
    "NutriLife Nutrition",
    "Nutri Life",
    "Nutrilife Diet",
    "Nutrilife Tracker",
    "NutriLife Calorie Counter",
    "Nutrilife AI Assistant",
    "AI Calorie Analysis",
    "Personalized Diet Plans",
    "Wellness Companion",
    "Healthy Living AI",
    "Macronutrient Tracker",
    "Food Logging AI",
    "Weight Loss AI",
    "Calorie Counter AI",
    "Intermittent Fasting Tracker",
    "AI Food Scanner",
    "Healthy Meal Planning",
    "AI Fitness Coach",
    "Vegan Diet Plan AI",
    "Keto Assistant AI",
    "Science-backed Nutrition",
    "Meal Prep Assistant",
    "Custom Diet Protocols",
    "Nutritional Analysis AI",
    "AI Health Guide"
  ],

  authors: [{ name: "NutriLife Team", url: "https://nutrilife-h6uw.vercel.app" }],
  creator: "NutriLife",
  publisher: "NutriLife",

  robots: {
    index: true,
    follow: true,
    nocache: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  alternates: {
    canonical: "/",
  },

  openGraph: {
    title: "NutriLife - AI Nutrition Assistant",
    description:
      "Transform your health with AI-powered nutrition tracking and personalized meal planning. The future of healthy living is here.",
    url: "https://nutrilife-h6uw.vercel.app",
    siteName: "NutriLife",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/banner.png",
        width: 1200,
        height: 630,
        alt: "NutriLife AI Nutrition Assistant - Smart Meal Planning",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "NutriLife - AI Nutrition Assistant",
    description: "The smartest way to track your nutrition and reach your health goals with AI.",
    site: "@NutriLife",
    creator: "@NutriLife",
    images: ["/banner.png"],
  },

  icons: {
    icon: [
      { url: '/nutrilife-icon.png', type: 'image/png', sizes: '192x192' },
      { url: '/nutrilife-icon.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [
      { url: '/nutrilife-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      {
        rel: 'apple-touch-icon-precomposed',
        url: '/nutrilife-icon.png',
      },
    ],
  },

  manifest: "/manifest.json",

  verification: {
    google: "googleb48ff8844dc4b9d3",
    me: "safalswayam@gmail.com",
  },


  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NutriLife",
  },

  formatDetection: {
    telephone: false,
  },

  generator: 'NutriLife Engine'
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2d5a3d',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} ${inter.variable} font-sans antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                "name": "NutriLife",
                "alternateName": ["NutriLife AI", "NutriLife App"],
                "url": "https://nutrilife-h6uw.vercel.app"
              },
              {
                "@context": "https://schema.org",
                "@type": "SoftwareApplication",
                "name": "NutriLife",
                "operatingSystem": "Web",
                "applicationCategory": "HealthApplication",
                "description": "AI-powered nutrition and health assistant for smart meal planning and healthy living.",
                "offers": {
                  "@type": "Offer",
                  "price": "0",
                  "priceCurrency": "USD"
                },
                "aggregateRating": {
                  "@type": "AggregateRating",
                  "ratingValue": "4.9",
                  "ratingCount": "1250"
                }
              }
            ])
          }}
        />
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}>
          <AuthProvider>
            <AppShell>
              {children}
            </AppShell>
          </AuthProvider>
        </GoogleOAuthProvider>
        <Analytics />
      </body>
    </html>
  )
}