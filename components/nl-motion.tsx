"use client"

import { useRef } from "react"
import { motion, useInView, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

/* ═══════════════════════════════════════════════════════════════════════════
   Shared motion grammar, carried over from the landing page so the product
   feels like the same object: content arrives from depth (never slides), one
   soft ease everywhere, and reduced motion keeps the cross-fade while dropping
   scale — since a fade is the substitute for movement, not a casualty of it.
   ═══════════════════════════════════════════════════════════════════════════ */

export const EASE = [0.3, 0.26, 0.38, 1] as const

/** Reveals its children once, when scrolled into view. */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode
  delay?: number
  className?: string
  as?: "div" | "section" | "li"
}) {
  /* Typed as the element union `as` can produce — a div-only ref here was a
     lie for as="section"/"li" that the motion cast happily hid. */
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: "-12% 0px -12% 0px" })
  const reduced = !!useReducedMotion()
  const M = motion[Tag]

  return (
    <M
      ref={ref as React.Ref<never>}
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.965 }}
      animate={
        inView
          ? reduced
            ? { opacity: 1 }
            : { opacity: 1, scale: 1 }
          : undefined
      }
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </M>
  )
}

/** Staggers direct children in, on view. Pair with <RevealItem>. */
export function RevealGroup({
  children,
  stagger = 0.06,
  className,
}: {
  children: React.ReactNode
  stagger?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-10% 0px -10% 0px" })
  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      transition={{ staggerChildren: stagger }}
    >
      {children}
    </motion.div>
  )
}

export function RevealItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const reduced = !!useReducedMotion()
  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 },
        show: reduced
          ? { opacity: 1, transition: { duration: 0.5, ease: EASE } }
          : { opacity: 1, scale: 1, transition: { duration: 0.55, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  )
}

/** Page-level heading treatment: words arrive from depth, matching the landing. */
export function PageTitle({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  const reduced = !!useReducedMotion()
  const words = children.split(" ")
  return (
    <h1
      className={cn(
        "text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl",
        className
      )}
      aria-label={children}
    >
      <span aria-hidden="true">
        {words.map((w, i) => (
          <motion.span
            key={`${w}-${i}`}
            className="mr-[0.24em] inline-block last:mr-0"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.82 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, delay: 0.04 + i * 0.05, ease: EASE }}
          >
            {w}
          </motion.span>
        ))}
      </span>
    </h1>
  )
}
