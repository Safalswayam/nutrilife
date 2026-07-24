"use client"

import { Bell, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { EASE } from "@/components/nl-motion"

interface PageHeaderProps {
  title: string
  subtitle?: string
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  const [showSearch, setShowSearch] = useState(false)
  const reduced = !!useReducedMotion()

  return (
    <header className="flex flex-col gap-4 mb-9">
      <div className="flex items-start justify-between gap-4">
        <div>
          {/* Title words arrive from depth, matching the landing page's
              headline grammar so the product reads as one object. */}
          <h1
            aria-label={title}
            className="text-2xl md:text-[2rem] font-semibold tracking-[-0.04em] text-foreground leading-[1.1]"
          >
            <span aria-hidden="true">
              {title.split(" ").map((w, i) => (
                <motion.span
                  key={`${w}-${i}`}
                  className="mr-[0.24em] inline-block last:mr-0"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.84 }}
                  animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.03 + i * 0.05, ease: EASE }}
                >
                  {w}
                </motion.span>
              ))}
            </span>
          </h1>
          {subtitle && (
            <motion.p
              className="text-muted-foreground mt-2 max-w-xl leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.22, ease: EASE }}
            >
              {subtitle}
            </motion.p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className={`transition-all duration-300 ${showSearch ? "w-48 md:w-64" : "w-0"} overflow-hidden`}>
            <Input
              placeholder="Search..."
              className="h-9"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSearch(!showSearch)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Search className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground relative"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full" />
          </Button>
        </div>
      </div>
    </header>
  )
}
