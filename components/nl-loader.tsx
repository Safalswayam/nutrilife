"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { useReducedStable } from "@/components/nl-motion"

/* ═══════════════════════════════════════════════════════════════════════════
   SequenceLoader — a typographic wait, not a spinner.

   A spinner says "something is happening". This says WHAT is happening, in the
   product's own voice, so the wait becomes part of the story rather than dead
   air. It borrows the landing page's grammar: phrases cross-fade in place
   while the frame holds, headline words arrive from depth, and lime is spent
   on exactly one thing — the step you are on.

   The phrase sequence is content, not decoration, so it still advances under
   prefers-reduced-motion; only the depth and drift are dropped there.
   ═══════════════════════════════════════════════════════════════════════════ */

const EASE = [0.3, 0.26, 0.38, 1] as const

export type Phase = { title: string; detail: string }

export const DIET_PHASES: Phase[] = [
  { title: "Reading your goals", detail: "Your target, your activity, the pace you asked for" },
  { title: "Balancing the macros", detail: "Protein, carbohydrate and fat across all seven days" },
  { title: "Choosing real meals", detail: "Matching your schedule and the foods you actually enjoy" },
  { title: "Writing your week", detail: "Laying it out so it holds up on a busy day" },
]

export const ANALYZER_PHASES: Phase[] = [
  { title: "Reading the plate", detail: "Finding the edges of everything in frame" },
  { title: "Naming what's there", detail: "Matching each item against the nutrition database" },
  { title: "Judging the portion", detail: "Estimating weight from what the photo can show" },
  { title: "Doing the arithmetic", detail: "Turning all of that into calories and macros" },
]

function Word({
  word,
  index,
  reduced,
}: {
  word: string
  index: number
  reduced: boolean
}) {
  return (
    <motion.span
      className="mr-[0.24em] inline-block last:mr-0"
      initial={{ opacity: 0, scale: 0.82 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.055, ease: EASE }}
    >
      {word}
    </motion.span>
  )
}

export function SequenceLoader({
  phases,
  /** ms each phase holds before advancing; the last one waits indefinitely */
  interval = 2600,
  className,
  label = "Working",
}: {
  phases: Phase[]
  interval?: number
  className?: string
  label?: string
}) {
  const reduced = useReducedStable()
  const [i, setI] = useState(0)

  useEffect(() => {
    if (i >= phases.length - 1) return
    const t = setTimeout(() => setI((n) => n + 1), interval)
    return () => clearTimeout(t)
  }, [i, interval, phases.length])

  const phase = phases[i]

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-[1.75rem] p-8 sm:p-10", className)}
      style={{
        background:
          "radial-gradient(120% 100% at 20% 0%, rgba(21,94,58,0.24) 0%, transparent 65%), linear-gradient(180deg, rgba(19,42,30,0.92), rgba(11,27,20,0.94))",
        border: "1px solid var(--nl-hairline)",
      }}
      role="status"
      aria-live="polite"
    >
      {/* Real text for assistive tech. A live region announces CONTENT changes,
          not attribute changes — with every visible child aria-hidden, an
          aria-label alone would be read once and then stay silent. */}
      <span className="sr-only">
        {label}: {phase.title}. Step {i + 1} of {phases.length}.
      </span>

      {/* step counter */}
      <div className="mb-7 flex items-center gap-3">
        <span className="font-mono text-[11px] tracking-[0.28em] text-nl-lime">
          {String(i + 1).padStart(2, "0")}
        </span>
        <span className="h-px flex-1 bg-[var(--nl-hairline)]" />
        <span className="font-mono text-[11px] tracking-[0.28em] text-nl-sage">
          {String(phases.length).padStart(2, "0")}
        </span>
      </div>

      {/* the phrase — cross-fades in place, words arrive from depth */}
      <div className="grid min-h-[7.5rem] sm:min-h-[8.5rem]">
        <motion.div
          key={i}
          className="[grid-area:1/1] self-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          <h3
            aria-hidden="true"
            className="text-2xl font-semibold leading-[1.1] tracking-[-0.04em] text-nl-warm sm:text-[2rem]"
          >
            {phase.title.split(" ").map((w, wi) => (
              <Word key={`${i}-${wi}`} word={w} index={wi} reduced={reduced} />
            ))}
          </h3>
          <motion.p
            aria-hidden="true"
            className="mt-3 max-w-md text-sm leading-relaxed text-nl-sage"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.26, ease: EASE }}
          >
            {phase.detail}
          </motion.p>
        </motion.div>
      </div>

      {/* Step rail. Completed steps fill solid; the ACTIVE step pulses rather
          than filling on a timer — the old version drained a determinate-looking
          bar to 100% in a fixed ~10s regardless of the real request, so a slow
          response left the user staring at a finished progress bar.
          scaleX/opacity only, so this never triggers layout. */}
      <div className="mt-8 flex gap-1.5" aria-hidden="true">
        {phases.map((p, pi) => (
          <span key={p.title} className="h-[3px] flex-1 overflow-hidden rounded-full bg-nl-warm/10">
            {pi < i ? (
              <motion.span
                className="block h-full origin-left rounded-full bg-nl-lime"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.3, ease: EASE }}
              />
            ) : pi === i ? (
              <motion.span
                className="block h-full origin-left rounded-full bg-nl-lime"
                initial={{ scaleX: 0.15, opacity: 0.5 }}
                animate={
                  reduced
                    ? { scaleX: 1, opacity: 1 }
                    : { scaleX: [0.15, 1, 0.15], opacity: [0.5, 1, 0.5] }
                }
                transition={
                  reduced
                    ? { duration: 0.3, ease: EASE }
                    : { duration: 1.6, ease: "easeInOut", repeat: Infinity }
                }
              />
            ) : null}
          </span>
        ))}
      </div>
    </div>
  )
}

/* Compact inline variant for buttons and tight spaces: the same rotating
   language, one line, no chrome. */
export function SequenceLabel({
  phases,
  interval = 2600,
}: {
  phases: Phase[]
  interval?: number
}) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (i >= phases.length - 1) return
    const t = setTimeout(() => setI((n) => n + 1), interval)
    return () => clearTimeout(t)
  }, [i, interval, phases.length])

  return (
    <span className="relative inline-grid">
      <motion.span
        key={i}
        className="[grid-area:1/1]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: EASE }}
      >
        {phases[i].title}…
      </motion.span>
    </span>
  )
}
