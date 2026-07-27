"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import {
  motion,
  MotionConfig,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion"
import Lenis from "lenis"
import {
  ArrowDown,
  BarChart3,
  CalendarDays,
  Check,
  Flame,
  Home,
  Menu,
  RefreshCw,
  Settings,
  Utensils,
  X,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { useReducedStable } from "@/components/nl-motion"

/* ═══════════════════════════════════════════════════════════════════════════
   NutriLife landing — cinematic scroll narrative.

   One repeating mechanism: tall scroll tracks with a sticky 100svh stage;
   copy blocks cross-fade IN PLACE while the visual holds. A persistent fixed
   backdrop ties every chapter into one continuous scene.

   Motion model — the narrative ALWAYS plays. `prefers-reduced-motion` removes
   vestibular motion (parallax, zoom, drift, 3D rotation, smooth-scroll
   interception) but keeps sticky pinning and opacity cross-fades, which are
   the recommended substitute for motion rather than a casualty of it.

   Fluidity comes from spring-smoothing scroll progress once, at the source,
   and driving everything from motion values — no React state in the scroll
   path, so no re-renders while scrolling.
   ═══════════════════════════════════════════════════════════════════════════ */

const EASE = [0.3, 0.26, 0.38, 1] as const
const HAIRLINE = "border-[rgba(244,245,237,0.16)]"

const NAV = [
  { id: "log", label: "Log" },
  { id: "analyze", label: "Analyze" },
  { id: "plan", label: "Plan" },
  { id: "progress", label: "Progress" },
  { id: "plans", label: "Plans" },
] as const

/* Backdrop tints per chapter — stacked fixed layers cross-fade because
   CSS cannot interpolate between two gradients. */
const GLOW = "radial-gradient(45% 40% at 8% 32%, rgba(21,94,58,0.22) 0%, transparent 70%)"

const TINTS: Record<string, string> = {
  hero: `${GLOW}, radial-gradient(130% 100% at 72% 10%, #0d2b1d 0%, #07110d 58%, #050c09 100%)`,
  log: `${GLOW}, radial-gradient(120% 100% at 25% 30%, #0d2b1d 0%, #07110d 72%)`,
  analyze: `${GLOW}, radial-gradient(120% 100% at 70% 40%, #10402a 0%, #0d2b1d 45%, #07110d 100%)`,
  plan: `${GLOW}, radial-gradient(130% 110% at 30% 65%, #0b2317 0%, #07110d 75%)`,
  progress: "#f4f5ed",
  plans: `${GLOW}, radial-gradient(120% 100% at 75% 30%, #0d2b1d 0%, #07110d 68%)`,
  dashboard: `${GLOW}, radial-gradient(120% 100% at 50% 85%, #081810 0%, #040a07 70%)`,
}

/* ── scroll track: sticky stage + spring-smoothed progress ──────────────────
   The spring is the single biggest contributor to how the page feels. Raw
   scroll progress tracks the wheel 1:1 and reads mechanical; easing it once
   here makes every downstream transform glide. */

function useTrack() {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedStable()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  })
  /* Stiff and light on purpose. Lenis already lerps the scroll position, so a
     soft spring here would be a SECOND easing layer — that stacked lag is what
     made fast scrolls look like they skipped chapters. This is fast enough to
     track scroll almost 1:1, and only exists to smooth the discrete ~100px
     steps of a mouse wheel when Lenis is off (reduced motion). */
  const progress = useSpring(scrollYProgress, {
    stiffness: 400,
    damping: 45,
    mass: 0.12,
    restDelta: 0.0005,
  })
  return { ref, reduced, progress }
}

/* ── Stage: chapters cross-fade in place, and never move ───────────────────
   The stage is `position: fixed`, so it does not travel with the scroll at
   ALL. Only opacity and scale change.

   This replaces a sticky stage that was translated against its own scroll
   travel to hold it still. That approach could not work: `sticky` is resolved
   by the compositor every frame, while the counter-transform was computed in
   JS from a scroll value read one frame earlier. Each frame the element moved
   by Δ and was pulled back by the PREVIOUS Δ, and that permanent one-frame
   mismatch was the jitter — visible at any scroll speed, and impossible to
   tune away. A fixed element has nothing to cancel.

   Adjacent sections share their handoff window exactly: section A's `exit`
   (A's bottom edge crossing the viewport) and section B's `entry` (B's top
   edge crossing it) span the identical 1-viewport scroll range. So A fading
   out over that range while B fades in over the same range is a true
   cross-dissolve, with both pinned in the same place. */

/* Curves deliberately overlap rather than mirror. A symmetric linear
   cross-fade has both layers at ~0.2 in the middle, so the scene visibly dips
   (measured: total opacity fell to 0.39 at the midpoint). Here the incoming
   chapter ramps to full while the outgoing still holds, so coverage never
   drops below 1 and the handoff reads as a dissolve, not a dip. */
const FADE_IN = [0.3, 0.75] as const
const FADE_OUT = [0.55, 0.95] as const

function Stage({
  track,
  first = false,
  last = false,
  className,
  children,
}: {
  track: { ref: React.RefObject<HTMLElement | null>; reduced: boolean }
  first?: boolean
  last?: boolean
  className?: string
  children: React.ReactNode
}) {
  const { ref, reduced } = track
  const { scrollYProgress: entry } = useScroll({
    target: ref,
    offset: ["start end", "start start"],
  })
  const { scrollYProgress: exit } = useScroll({
    target: ref,
    offset: ["end end", "end start"],
  })

  /* Raw progress, deliberately unsprung: an opacity fade that lags the scroll
     is what makes a fast flick look like it skipped a chapter. */
  const fadeIn = useTransform(entry, [FADE_IN[0], FADE_IN[1]], [0, 1], { clamp: true })
  const fadeOut = useTransform(exit, [FADE_OUT[0], FADE_OUT[1]], [1, 0], { clamp: true })

  const opacity = useTransform([fadeIn, fadeOut] as MotionValue<number>[], ([i, o]: number[]) =>
    Math.min(first ? 1 : i, last ? 1 : o)
  )
  /* arrives from the background, departs past the viewer */
  const scale = useTransform([fadeIn, fadeOut] as MotionValue<number>[], ([i, o]: number[]) =>
    (first ? 1 : 0.86 + 0.14 * i) * (last ? 1 : 1 + 0.14 * (1 - o))
  )
  /* Hidden stages must cost nothing and must not swallow clicks — seven
     full-viewport fixed layers are stacked at all times. */
  const visibility = useTransform(opacity, (v) => (v > 0.004 ? "visible" : "hidden"))
  const pointerEvents = useTransform(opacity, (v) => (v > 0.5 ? "auto" : "none"))

  return (
    <motion.div
      className={cn("nl-stage-layer fixed inset-0 h-[100svh] overflow-hidden", className)}
      style={
        reduced
          ? { opacity, visibility, pointerEvents }
          : { opacity, scale, visibility, pointerEvents }
      }
    >
      {children}
    </motion.div>
  )
}

/* ── CopyBlock: the signature move ─────────────────────────────────────────
   Blocks stack in one grid cell and transition along Z: the outgoing block
   pushes toward and past the viewer while the incoming one arrives from the
   background — everything travels the same direction, so the sequence reads
   as a camera pressing forward. Segments overlap at their boundaries so both
   blocks occupy the same space mid-transition. Under reduced motion this
   collapses to a pure opacity cross-fade. */

const OVERLAP = 0.055

function CopyBlock({
  progress,
  from,
  to,
  first = false,
  last = false,
  className,
  children,
}: {
  progress: MotionValue<number>
  from: number
  to: number
  first?: boolean
  last?: boolean
  className?: string
  children: React.ReactNode | ((on: boolean) => React.ReactNode)
}) {
  const reduced = useReducedStable()
  const keys = [from - OVERLAP, from + OVERLAP, to - OVERLAP, to + OVERLAP]

  const opacity = useTransform(progress, keys, [first ? 1 : 0, 1, 1, last ? 1 : 0])
  /* depth: arrive from the background (0.82 → 1), depart past the viewer
     (1 → 1.22) — no vertical movement */
  const scale = useTransform(progress, keys, [first ? 1 : 0.82, 1, 1, last ? 1 : 1.22])
  /* No depth-of-field blur here: `filter` is not compositor-accelerated, so it
     repaints the block every frame. Scale plus the cross-fade already read as
     depth, and dropping it buys frames during the transition. */

  /* Derived from opacity, so they stay continuous and cause no re-render.
     pointerEvents stays 'none' rather than 'auto': the parent Stage already
     enables pointer events for the chapter that is actually on screen, and
     setting 'auto' here re-enabled clicks inside a Stage that had switched
     itself off mid-handoff, letting a barely-visible chapter swallow clicks. */
  const visibility = useTransform(opacity, (v) => (v > 0.008 ? "visible" : "hidden"))

  /* Only the boolean handed to children needs state, and it flips rarely —
     React bails out of identical values, so this is not a per-frame cost. */
  const [on, setOn] = useState(first)
  useMotionValueEvent(opacity, "change", (v) => setOn(v > 0.5))

  /* Coarse proximity gate for the word animations. Flips twice per pass, and
     React bails out on an unchanged value, so this is not a per-frame cost. */
  const [near, setNear] = useState(first)
  useMotionValueEvent(progress, "change", (v) => setNear(v > from - 0.12 && v < to + 0.12))

  /* Published so any <Waterfall> inside can map its words onto this block's
     own slice of the chapter, without every call site repeating the bounds. */
  const seg = useMemo<Seg>(
    () => ({ progress, from, to, first, last, near }),
    [progress, from, to, first, last, near]
  )

  return (
    <SegCtx.Provider value={seg}>
      <motion.div
        style={reduced ? { opacity, visibility } : { opacity, scale, visibility }}
        className={cn("[grid-area:1/1] self-center", className)}
      >
        {typeof children === "function" ? children(on) : children}
      </motion.div>
    </SegCtx.Provider>
  )
}

/* ── Waterfall text: words cascade IN and OUT, one after another ────────────
   Every line of chapter copy is set word by word rather than as a block. Words
   fall in from above in sequence as the block arrives, hold, then continue
   falling away in the same direction as it leaves — so the whole page reads as
   one downward flow instead of things appearing and vanishing wholesale.

   It is driven by the chapter's own scroll progress, not a timer, so it scrubs
   with the wheel and reverses when you scroll back up. Each word owns a slice
   of the block's entry and exit zones; the slices overlap so the cascade is
   continuous rather than a staccato pop per word. */

const ENTRY_ZONE = 0.3 // fraction of the block's segment spent cascading in
const EXIT_ZONE = 0.24 // ...and cascading out
const WORD_RAMP = 0.45 // each word's own ramp, as a fraction of its zone

type Seg = {
  progress: MotionValue<number>
  from: number
  to: number
  first: boolean
  last: boolean
  /* Whether this block is close enough to its window to be worth animating.
     Without this every word in every chapter keeps a live subscription and
     writes a style each frame — ~200 words cost roughly 12fps. */
  near: boolean
}
const SegCtx = createContext<Seg | null>(null)

function WaterfallWord({
  word,
  i,
  n,
  seg,
  lime,
}: {
  word: string
  i: number
  n: number
  seg: Seg
  lime?: boolean
}) {
  const reduced = useReducedStable()
  const { progress, from, to, last } = seg
  const L = Math.max(to - from, 0.001)
  const span = n > 1 ? i / (n - 1) : 0

  /* One keyframe track per property, read straight off the chapter's progress.
     Chaining intermediate motion values instead cost about 10fps across a
     transition, because every word re-derived through four subscriptions. */
  const inLen = L * ENTRY_ZONE
  const inS = from + span * inLen * (1 - WORD_RAMP)
  const inE = inS + inLen * WORD_RAMP

  const outLen = L * EXIT_ZONE
  const outS = last ? 1e4 : to - outLen + span * outLen * (1 - WORD_RAMP)
  const outE = last ? 1e4 + 1 : outS + outLen * WORD_RAMP

  const stops = [inS, inE, outS, outE]
  const opacity = useTransform(progress, stops, [0, 1, 1, 0], { clamp: true })
  /* Falls in from above, then keeps falling on the way out — same direction
     throughout, which is what makes it read as a waterfall rather than a
     bounce. `em` so the travel scales with the type size. */
  const y = useTransform(progress, stops, ["-0.42em", "0em", "0em", "0.38em"], { clamp: true })

  return (
    <motion.span
      style={reduced ? { opacity } : { opacity, y }}
      className={cn("mr-[0.24em] inline-block last:mr-0", lime && "text-nl-lime")}
    >
      {word}
    </motion.span>
  )
}

/** Sets `text` word by word inside the enclosing CopyBlock's segment. */
function Waterfall({
  text,
  as: Tag = "p",
  className,
  limeWord,
}: {
  text: string
  as?: "h2" | "p" | "span"
  className?: string
  limeWord?: string
}) {
  const seg = useContext(SegCtx)
  const words = text.split(" ")
  if (!seg) return <Tag className={className}>{text}</Tag>

  /* Far from its window the block is hidden anyway, so drop the motion values
     entirely rather than paying to animate something nobody can see. */
  if (!seg.near) {
    return (
      <Tag className={className} aria-label={text}>
        <span aria-hidden="true" style={{ opacity: 0 }}>
          {text}
        </span>
      </Tag>
    )
  }

  return (
    <Tag className={className} aria-label={text}>
      <span aria-hidden="true">
        {words.map((w, i) => (
          <WaterfallWord
            key={`${w}-${i}`}
            word={w}
            i={i}
            n={words.length}
            seg={seg}
            lime={!!limeWord && w.replace(/[^\w-]/g, "") === limeWord}
          />
        ))}
      </span>
    </Tag>
  )
}

function RevealHeadline({ text, className }: { text: string; className?: string }) {
  return <Waterfall text={text} as="h2" className={className} />
}

/* Text-zone layouts: odd chapters inset left, even chapters centered. */
const ZONE_LEFT =
  "relative z-10 grid h-full content-center px-6 sm:px-10 md:pl-[200px] md:pr-[52%]"
const ZONE_CENTER =
  "relative z-10 grid h-full content-center place-items-center px-6 text-center sm:px-10 md:px-[14%]"

function Eyebrow({ children, light = false }: { children: string; light?: boolean }) {
  return (
    <Waterfall
      text={children}
      className={cn(
        "mb-5 text-[11px] font-medium uppercase tracking-[0.3em] sm:text-xs",
        light ? "text-nl-forest" : "text-nl-sage"
      )}
    />
  )
}

/* ═══ Intro overlay — under 1.3s, never blocks on images ═══════════════════ */

function IntroOverlay({ onReveal, onDone }: { onReveal: () => void; onDone: () => void }) {
  const reduced = useReducedStable()
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    if (reduced) {
      onReveal()
      onDone()
      return
    }
    const t1 = setTimeout(() => {
      setOpening(true)
      onReveal()
    }, 900)
    const t2 = setTimeout(onDone, 1300)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [reduced, onReveal, onDone])

  /* No `if (reduced) return null` here. useReducedMotion is false during SSR
     and true on the client, so branching the DOM on it threw a hydration
     mismatch. The markup is now identical on both sides and CSS hides the
     overlay outright under reduced motion — no flash, no mismatch. */
  return (
    <div
      aria-hidden="true"
      className={cn(
        "nl-intro fixed inset-0 z-[100] flex flex-col items-center justify-center bg-nl-ink",
        opening && "nl-intro-open"
      )}
    >
      <div
        className="size-2.5 rounded-full bg-nl-lime"
        style={{ animation: "nl-seed 0.3s ease-out both" }}
      />
      <div
        className="absolute size-44 rounded-full bg-nl-lime/60 blur-3xl"
        style={{ animation: "nl-bloom 0.6s var(--nl-ease) 0.35s both" }}
      />
      <div
        className="absolute h-px w-44 bg-gradient-to-r from-transparent via-nl-lime/70 to-transparent blur-[2px]"
        style={{ animation: "nl-streak-l 0.55s var(--nl-ease) 0.38s both" }}
      />
      <div
        className="absolute h-px w-44 bg-gradient-to-r from-transparent via-nl-lime/70 to-transparent blur-[2px]"
        style={{ animation: "nl-streak-r 0.55s var(--nl-ease) 0.38s both" }}
      />
      <p className="mt-8 text-[10px] uppercase tracking-[0.34em] text-nl-warm/30">
        Preparing your nutrition story
      </p>
    </div>
  )
}

/* ═══ Persistent fixed backdrop ════════════════════════════════════════════ */

/* Only two tint layers are ever mounted: the outgoing one underneath and the
   incoming one fading over it. Mounting all seven cost ~9fps in reduced motion
   and ~15fps in full motion, because every layer re-composited each frame.
   The atmosphere glow is folded into the gradients rather than carried by
   separate blur-3xl blobs, which cost another ~3-4fps for two huge blurred
   surfaces that sit behind grain and imagery anyway. */
function Backdrop({ active }: { active: string }) {
  const [base, setBase] = useState(active)
  useEffect(() => {
    if (base === active) return
    const t = setTimeout(() => setBase(active), 1300)
    return () => clearTimeout(t)
  }, [active, base])

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{ background: TINTS[base] ?? TINTS.hero }} />
        {base !== active && (
          <motion.div
            key={active}
            className="absolute inset-0"
            style={{ background: TINTS[active] ?? TINTS.hero }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, ease: EASE }}
          />
        )}
      </div>
      {/* grain is its own isolated, never-changing layer */}
      <div aria-hidden="true" className="nl-grain pointer-events-none fixed inset-0" />
    </>
  )
}

/* ═══ Header ═══════════════════════════════════════════════════════════════ */

function SiteHeader({
  active,
  light,
  onJump,
  onOpenMenu,
}: {
  active: string
  light: boolean
  onJump: (id: string) => void
  onOpenMenu: () => void
}) {
  const [scrolled, setScrolled] = useState(false)
  const { scrollY } = useScroll()
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 32))

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 border-b transition-all duration-500",
        scrolled
          ? cn(light ? "bg-nl-warm/75" : "bg-nl-ink/70", "backdrop-blur-md", HAIRLINE)
          : "border-transparent",
        light ? "text-nl-ink" : "text-nl-warm"
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.32em] focus-visible:outline-2"
        >
          Nutrilife
        </Link>

        <nav aria-label="Chapters" className="hidden md:block">
          <ul className="flex items-center gap-8">
            {NAV.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    onJump(item.id)
                  }}
                  aria-current={active === item.id ? "true" : undefined}
                  className={cn(
                    "relative text-[13px] font-medium tracking-wide transition-opacity duration-300 hover:opacity-100 focus-visible:opacity-100",
                    active === item.id ? "opacity-100" : "opacity-60"
                  )}
                >
                  {item.label}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute -bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full transition-all duration-300",
                      light ? "bg-nl-forest" : "bg-nl-lime",
                      active === item.id ? "scale-100 opacity-100" : "scale-0 opacity-0"
                    )}
                  />
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/signup"
            className="rounded-full bg-nl-lime px-4 py-2 text-[13px] font-semibold text-nl-ink transition-transform duration-300 hover:scale-[1.04] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Start free
          </Link>
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open menu"
            className={cn(
              "rounded-full border p-2 transition-colors md:hidden",
              light ? "border-nl-ink/25" : HAIRLINE
            )}
          >
            <Menu className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}

function MobileMenu({ onClose, onJump }: { onClose: () => void; onJump: (id: string) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="fixed inset-0 z-50 flex flex-col bg-nl-ink/[0.97] text-nl-warm backdrop-blur-sm"
    >
      <div className="flex h-16 items-center justify-between px-5">
        <span className="text-sm font-semibold uppercase tracking-[0.32em]">Nutrilife</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className={cn("rounded-full border p-2", HAIRLINE)}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <nav aria-label="Chapters" className="flex flex-1 flex-col justify-center px-8">
        <ul className="space-y-5">
          {NAV.map((item, i) => (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.06 + i * 0.05, ease: EASE }}
            >
              <a
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  onClose()
                  onJump(item.id)
                }}
                className="flex items-baseline gap-4 text-3xl font-semibold tracking-[-0.03em] transition-colors hover:text-nl-lime focus-visible:text-nl-lime"
              >
                <span className="text-xs text-nl-sage">0{i + 1}</span>
                {item.label}
              </a>
            </motion.li>
          ))}
        </ul>
        <div className="mt-12 flex items-center gap-6">
          <Link
            href="/signup"
            className="rounded-full bg-nl-lime px-6 py-3 text-sm font-semibold text-nl-ink"
          >
            Start free
          </Link>
          <Link href="/login" className="text-sm text-nl-sage underline-offset-4 hover:underline">
            Log in
          </Link>
        </div>
      </nav>
    </motion.div>
  )
}

/* ═══ Scene rail ═══════════════════════════════════════════════════════════ */

function SceneRail({
  active,
  light,
  onJump,
}: {
  active: string
  light: boolean
  onJump: (id: string) => void
}) {
  return (
    <nav
      aria-label="Scene navigation"
      className="fixed right-7 top-1/2 z-40 hidden -translate-y-1/2 md:block"
    >
      <ul className="flex flex-col gap-3">
        {NAV.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onJump(item.id)}
              data-active={active === item.id}
              className={cn(
                "nl-rail-dot group relative flex size-7 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2",
                light ? "text-nl-ink" : "text-nl-warm"
              )}
            >
              <span className="sr-only">Go to {item.label}</span>
              <span
                aria-hidden="true"
                className={cn(
                  "absolute right-full mr-3 translate-x-1 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] tracking-wide opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100",
                  light ? "border-nl-ink/20 bg-nl-warm/80" : cn(HAIRLINE, "bg-nl-ink/80")
                )}
              >
                {item.label}
              </span>
              <svg
                viewBox="0 0 32 32"
                className="absolute inset-0 size-full -rotate-90"
                aria-hidden="true"
              >
                <circle
                  cx="16"
                  cy="16"
                  r="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="nl-rail-ring"
                />
              </svg>
              <span
                aria-hidden="true"
                className={cn(
                  "rounded-full transition-all duration-300",
                  active === item.id
                    ? "size-[6px] bg-nl-lime"
                    : "size-[5px] bg-current opacity-40"
                )}
              />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/* ═══ Hero ═════════════════════════════════════════════════════════════════ */

const HERO_LINES: string[][] = [["Food", "clarity"], ["for", "every"], ["real-life"], ["day."]]

const heroWord = {
  hidden: { opacity: 0, y: "0.7em", rotateX: 38 },
  show: {
    opacity: 1,
    y: "0em",
    rotateX: 0,
    transition: { duration: 0.72, ease: [0.22, 1, 0.36, 1] as const },
  },
}

function Hero({ started, onCue }: { started: boolean; onCue: () => void }) {
  const track = useTrack()
  const { ref, reduced, progress } = track
  /* Content lifts and dissolves; the image pushes in slightly deeper and
     slower, so the two layers separate as the hero leaves. */
  const contentOpacity = useTransform(progress, [0.35, 0.85], [1, 0])
  const contentY = useTransform(progress, [0, 0.85], [0, -110])
  const imgScale = useTransform(progress, [0, 1], [1, 1.14])
  const imgY = useTransform(progress, [0, 1], ["0%", "6%"])
  const veil = useTransform(progress, [0.3, 1], [0, 0.55])
  const cueOpacity = useTransform(progress, [0, 0.18], [1, 0])
  const show = reduced || started

  return (
    <section ref={ref} data-chapter="hero" className="relative" style={{ height: "200svh" }}>
      <Stage track={track} first>
        {/* visual */}
        <motion.div
          aria-hidden="true"
          className="absolute inset-0"
          style={reduced ? undefined : { scale: imgScale, y: imgY }}
        >
          <Image
            src="/nutrilife-landing/hero-nutrition-orbit.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          {/* both scrims in one element — two stacked full-viewport gradient
              layers composite separately and measured ~10fps during a seam */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to top, rgba(7,17,13,0.8), transparent 50%, rgba(7,17,13,0.4)), linear-gradient(to right, rgba(7,17,13,0.95), rgba(7,17,13,0.6) 50%, rgba(13,43,29,0.25))",
            }}
          />
        </motion.div>
        {/* deepening veil as the hero recedes */}
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 bg-nl-ink"
          style={reduced ? { opacity: 0 } : { opacity: veil }}
        />

        {/* side captions */}
        <motion.p
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={show ? { opacity: 1 } : undefined}
          transition={{ duration: 0.9, delay: 0.75, ease: EASE }}
          className="absolute left-4 top-24 z-10 text-[10px] uppercase tracking-[0.3em] text-nl-sage [writing-mode:vertical-rl] md:left-[114px] md:top-1/2 md:-translate-y-1/2"
        >
          Your health, in context.
        </motion.p>
        <motion.p
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={show ? { opacity: 1 } : undefined}
          transition={{ duration: 0.9, delay: 0.82, ease: EASE }}
          className="absolute right-4 top-24 z-10 text-[10px] uppercase tracking-[0.3em] text-nl-sage [writing-mode:vertical-rl] md:right-[114px] md:top-1/2 md:-translate-y-1/2"
        >
          Since every meal counts.
        </motion.p>

        {/* content */}
        <motion.div
          className="relative z-10 flex h-full flex-col justify-center px-8 sm:px-14 md:pl-[200px]"
          style={reduced ? undefined : { opacity: contentOpacity, y: contentY }}
        >
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={show ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.6, delay: 0.08, ease: EASE }}
            className="mb-6 text-[11px] font-medium uppercase tracking-[0.32em] text-nl-sage sm:text-xs"
          >
            Nutrition, made clear
          </motion.p>

          <motion.h1
            aria-label="Food clarity for every real-life day."
            initial="hidden"
            animate={show ? "show" : "hidden"}
            transition={{ staggerChildren: 0.07, delayChildren: 0.14 }}
            style={{ perspective: 900, transformStyle: "preserve-3d" }}
            className="max-w-[14ch] text-[3rem] font-semibold leading-[1.02] tracking-[-0.04em] text-nl-warm min-[430px]:text-[3.75rem] md:text-[5rem]"
          >
            {HERO_LINES.map((line, li) => (
              <span key={li} aria-hidden="true" className="block">
                {line.map((word) => (
                  <motion.span
                    key={word}
                    variants={heroWord}
                    className={cn(
                      "nl-hero-word mr-[0.28em] last:mr-0",
                      word === "clarity" && "text-nl-lime"
                    )}
                  >
                    {word}
                  </motion.span>
                ))}
              </span>
            ))}
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={show ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.65, delay: 0.62, ease: EASE }}
          >
            <p className="mt-7 max-w-md text-[15px] leading-relaxed text-nl-warm/80">
              Log what you eat, understand what it means, and follow a plan that fits your life.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-6">
              <Link
                href="/signup"
                className="rounded-full bg-nl-lime px-7 py-3.5 text-sm font-semibold text-nl-ink transition-transform duration-300 hover:scale-[1.04] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Start your free plan
              </Link>
              <a
                href="#log"
                onClick={(e) => {
                  e.preventDefault()
                  onCue()
                }}
                className="text-sm text-nl-warm/70 underline-offset-4 transition-colors hover:text-nl-warm focus-visible:text-nl-warm"
              >
                See how it works ↓
              </a>
            </div>
          </motion.div>
        </motion.div>

        {/* circular scroll cue */}
        <motion.button
          type="button"
          onClick={onCue}
          aria-label="Scroll to the first chapter"
          style={reduced ? undefined : { opacity: cueOpacity }}
          className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-nl-warm/80 transition-colors hover:text-nl-lime focus-visible:text-nl-lime md:bottom-16 md:left-auto md:right-[114px] md:translate-x-0"
        >
          <span className="relative flex size-[74px] items-center justify-center">
            <svg
              viewBox="0 0 74 74"
              className="nl-scroll-cue-ring absolute inset-0 size-full"
              aria-hidden="true"
            >
              <defs>
                <path id="nl-cue-circle" d="M37,37 m-27,0 a27,27 0 1,1 54,0 a27,27 0 1,1 -54,0" />
              </defs>
              <text className="fill-current text-[8.5px] uppercase tracking-[2.6px]">
                <textPath href="#nl-cue-circle">Scroll · discover · scroll ·</textPath>
              </text>
            </svg>
            <ArrowDown className="size-4 nl-cue-arrow" aria-hidden="true" />
          </span>
        </motion.button>
      </Stage>
    </section>
  )
}

/* ═══ Chapter visual: shared drift + settle for the pinned image ═══════════ */

function ChapterVisual({
  src,
  progress,
  className,
  imgClassName,
  from = 1.16,
  to = 1.0,
  drift = 4,
}: {
  src: string
  progress: MotionValue<number>
  className?: string
  imgClassName?: string
  from?: number
  to?: number
  drift?: number
}) {
  const reduced = useReducedStable()
  const scale = useTransform(progress, [0, 1], [from, to])
  const y = useTransform(progress, [0, 1], [`${-drift / 2}%`, `${drift / 2}%`])
  return (
    <div aria-hidden="true" className={cn("absolute inset-0 overflow-hidden", className)}>
      <motion.div
        className="absolute -inset-y-[6%] inset-x-0"
        style={reduced ? undefined : { scale, y }}
      >
        <Image src={src} alt="" fill sizes="100vw" className={cn("object-cover", imgClassName)} />
      </motion.div>
    </div>
  )
}

/* ═══ Chapter 1 — Food logging (#log) ══════════════════════════════════════ */

function FoodLogCard({ on }: { on: boolean }) {
  const reduced = useReducedStable()
  const chips = ["420 kcal", "P 14 g", "C 58 g", "F 11 g"]
  return (
    <div
      className={cn(
        /* opaque rather than backdrop-blurred: a backdrop filter cannot be
           cached while an ancestor stage fades, so it resampled every frame */
        "relative w-full max-w-sm rounded-2xl border bg-nl-pine/90 p-5",
        HAIRLINE
      )}
    >
      <motion.span
        className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full bg-nl-lime"
        aria-hidden="true"
        initial={{ scale: 0 }}
        animate={reduced || on ? { scale: 1 } : { scale: 0 }}
        transition={{ duration: 0.45, delay: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <Check className="size-4 text-nl-ink" strokeWidth={3} />
      </motion.span>
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-nl-forest to-nl-pine"
        >
          <Utensils className="size-5 text-nl-warm/90" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-nl-warm">Berry oat bowl</p>
          <p className="text-xs text-nl-sage">Breakfast · 8:12 am</p>
        </div>
      </div>
      <ul className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium text-nl-warm/85">
        {chips.map((chip, i) => (
          <motion.li
            key={chip}
            className={cn("rounded-full border px-3 py-1", HAIRLINE)}
            initial={{ opacity: 0, y: 8 }}
            animate={reduced || on ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.4, delay: 0.18 + i * 0.06, ease: EASE }}
          >
            {chip}
          </motion.li>
        ))}
      </ul>
    </div>
  )
}

function ChapterLog() {
  const track = useTrack()
  const { ref, progress } = track
  return (
    <section ref={ref} id="log" data-chapter="log" className="relative" style={{ height: "420svh" }}>
      <Stage track={track}>
        <ChapterVisual
          src="/nutrilife-landing/food-logging.png"
          progress={progress}
          className="md:left-[46%]"
          imgClassName="object-right"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-nl-ink via-nl-ink/70 to-nl-ink/30 md:from-nl-ink md:via-nl-ink/35 md:to-transparent"
        />

        <div className={ZONE_LEFT}>
          <CopyBlock progress={progress} from={0} to={0.38} first>
            <Eyebrow>01 / Food logging</Eyebrow>
            <RevealHeadline
              text="Log a meal before life moves on."
              className="text-3xl font-semibold leading-[1.05] tracking-[-0.04em] text-nl-warm sm:text-4xl md:text-5xl"
            />
          </CopyBlock>

          <CopyBlock progress={progress} from={0.38} to={0.68}>
            <Waterfall
              text="Snap it, search it, or add it your way. NutriLife turns ordinary meals into a clear, usable daily record."
              className="max-w-md text-lg leading-relaxed text-nl-warm/85"
            />
          </CopyBlock>

          <CopyBlock progress={progress} from={0.68} to={1} last>
            {(on) => (
              <>
                <p className="mb-5 text-sm uppercase tracking-[0.24em] text-nl-sage">
                  Logged in seconds
                </p>
                <FoodLogCard on={on} />
              </>
            )}
          </CopyBlock>
        </div>
      </Stage>
    </section>
  )
}

/* ═══ Chapter 2 — Food analyzer (#analyze) ═════════════════════════════════ */

const MACROS = [
  { label: "Protein", value: "32 g", pct: 72 },
  { label: "Fibre", value: "9 g", pct: 58 },
  { label: "Energy", value: "612 kcal", pct: 64 },
]

function MacroModule({ on }: { on: boolean }) {
  const reduced = useReducedStable()
  const C = 2 * Math.PI * 50
  const target = C * (1 - 0.68)
  return (
    <div
      className={cn("w-full max-w-md rounded-2xl border bg-nl-ink/88 p-6", HAIRLINE)}
    >
      <div className="flex items-center gap-6">
        <svg
          viewBox="0 0 120 120"
          className="size-28 shrink-0 -rotate-90"
          role="img"
          aria-label="Meal balance: 68 percent"
        >
          <circle cx="60" cy="60" r="50" fill="none" strokeWidth="9" className="stroke-nl-warm/10" />
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            strokeWidth="9"
            strokeLinecap="round"
            className="stroke-nl-lime"
            strokeDasharray={C}
            style={{
              strokeDashoffset: reduced || on ? target : C,
              transition: reduced ? undefined : "stroke-dashoffset 1.3s var(--nl-ease) 0.15s",
            }}
          />
        </svg>
        <div className="text-left">
          <p className="text-3xl font-semibold tracking-[-0.03em] text-nl-warm">68%</p>
          <p className="text-sm text-nl-sage">balanced plate</p>
        </div>
      </div>
      <ul className="mt-6 space-y-4">
        {MACROS.map((m, i) => (
          <li key={m.label}>
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="text-nl-warm/85">{m.label}</span>
              <span className="font-medium text-nl-warm">{m.value}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-nl-warm/10">
              <div
                className="h-full rounded-full bg-nl-forest"
                style={{
                  width: `${m.pct}%`,
                  transform: reduced || on ? "scaleX(1)" : "scaleX(0)",
                  transformOrigin: "left",
                  transition: reduced
                    ? undefined
                    : `transform 0.95s var(--nl-ease) ${0.3 + i * 0.13}s`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ChapterAnalyze() {
  const track = useTrack()
  const { ref, reduced, progress } = track
  const [scan, setScan] = useState(false)
  useMotionValueEvent(progress, "change", (v) => {
    if (v > 0.04) setScan(true)
  })
  /* within-chapter tint shift: pine → clearer emerald, insight arriving */
  const emerald = useTransform(progress, [0.2, 0.8], [0, 1])
  const imgOpacity = useTransform(progress, [0, 0.5], [0.3, 0.48])

  return (
    <section
      ref={ref}
      id="analyze"
      data-chapter="analyze"
      className="relative"
      style={{ height: "420svh" }}
    >
      <Stage track={track}>
        <motion.div
          aria-hidden="true"
          className="absolute inset-0"
          style={reduced ? { opacity: 0.45 } : { opacity: imgOpacity }}
        >
          <ChapterVisual
            src="/nutrilife-landing/food-analyzer.png"
            progress={progress}
            imgClassName="object-right"
            from={1.2}
            to={1.02}
          />
        </motion.div>
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-nl-ink/85 via-nl-pine/60 to-nl-ink/90"
        />
        <motion.div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            opacity: reduced ? 0.5 : emerald,
            background:
              "radial-gradient(90% 70% at 50% 45%, rgba(21,94,58,0.4) 0%, transparent 70%)",
          }}
        />
        <div aria-hidden="true" className="nl-scan" data-active={scan} />

        <div className={ZONE_CENTER}>
          <CopyBlock progress={progress} from={0} to={0.36} first>
            <Eyebrow>02 / Food analyzer</Eyebrow>
            <RevealHeadline
              text="See what your plate is telling you."
              className="mx-auto max-w-[16ch] text-3xl font-semibold leading-[1.05] tracking-[-0.04em] text-nl-warm sm:text-4xl md:text-5xl"
            />
          </CopyBlock>

          <CopyBlock progress={progress} from={0.36} to={0.64}>
            <Waterfall
              text="A simple analysis turns the meal in front of you into practical nutrition—not a lecture."
              className="mx-auto max-w-md text-lg leading-relaxed text-nl-warm/85"
            />
          </CopyBlock>

          <CopyBlock
            progress={progress}
            from={0.64}
            to={1}
            last
            className="w-full max-w-md justify-self-center"
          >
            {(on) => <MacroModule on={on} />}
          </CopyBlock>
        </div>
      </Stage>
    </section>
  )
}

/* ═══ Chapter 3 — Diet planner (#plan) ═════════════════════════════════════ */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const DINNERS = ["Lemon-herb salmon", "Chickpea curry bowl", "Grilled paneer + dal"]

function WeeklyPlanCard({ on }: { on: boolean }) {
  const reduced = useReducedStable()
  const [day, setDay] = useState(2)
  const [dinner, setDinner] = useState(0)
  const rows = [
    ["Breakfast", "Berry oat bowl"],
    ["Lunch", "Paneer grain bowl"],
  ]
  return (
    <div
      className={cn("w-full max-w-md rounded-2xl border bg-nl-pine/90 p-5", HAIRLINE)}
    >
      <div role="group" aria-label="Day of the week" className="flex flex-wrap gap-1.5">
        {DAYS.map((d, i) => (
          <motion.button
            key={d}
            type="button"
            aria-pressed={day === i}
            onClick={() => setDay(i)}
            initial={{ opacity: 0, y: 6 }}
            animate={reduced || on ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
            transition={{ duration: 0.35, delay: 0.1 + i * 0.04, ease: EASE }}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
              day === i
                ? "bg-nl-warm text-nl-ink"
                : cn("border text-nl-sage hover:text-nl-warm", HAIRLINE)
            )}
          >
            {d}
          </motion.button>
        ))}
      </div>
      <ul className="mt-5 space-y-3.5">
        {rows.map(([k, v], i) => (
          <motion.li
            key={k}
            className="flex items-baseline justify-between gap-3 text-sm"
            initial={{ opacity: 0, x: -10 }}
            animate={reduced || on ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
            transition={{ duration: 0.4, delay: 0.34 + i * 0.08, ease: EASE }}
          >
            <span className="shrink-0 text-nl-sage">{k}</span>
            <span className="text-right font-medium text-nl-warm">{v}</span>
          </motion.li>
        ))}
        <motion.li
          className="flex items-center justify-between gap-3 text-sm"
          initial={{ opacity: 0, x: -10 }}
          animate={reduced || on ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
          transition={{ duration: 0.4, delay: 0.5, ease: EASE }}
        >
          <span className="shrink-0 text-nl-sage">Dinner</span>
          <span className="flex min-w-0 items-center gap-2.5">
            <span aria-live="polite" className="truncate font-medium text-nl-warm">
              {DINNERS[dinner]}
            </span>
            <button
              type="button"
              onClick={() => setDinner((d) => (d + 1) % DINNERS.length)}
              aria-label={`Swap dinner. Current: ${DINNERS[dinner]}`}
              className={cn(
                "group flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] text-nl-warm/85 transition-colors hover:border-nl-lime/60 hover:text-nl-lime focus-visible:outline-2 focus-visible:outline-offset-2",
                HAIRLINE
              )}
            >
              <RefreshCw
                className="size-3 transition-transform duration-500 group-hover:rotate-180"
                aria-hidden="true"
              />
              Easy swap
            </button>
          </span>
        </motion.li>
      </ul>
    </div>
  )
}

function ChapterPlan() {
  const track = useTrack()
  const { ref, progress } = track
  return (
    <section ref={ref} id="plan" data-chapter="plan" className="relative" style={{ height: "440svh" }}>
      <Stage track={track}>
        {/* planner grid parallaxes within the spec's 4% ceiling */}
        <ChapterVisual
          src="/nutrilife-landing/diet-planner.png"
          progress={progress}
          className="md:left-[46%]"
          imgClassName="object-[70%_65%]"
          from={1.1}
          to={1.0}
          drift={4}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-nl-ink via-nl-ink/70 to-nl-ink/30 md:from-nl-ink md:via-nl-ink/35 md:to-transparent"
        />

        <div className={ZONE_LEFT}>
          <CopyBlock progress={progress} from={0} to={0.32} first>
            <Eyebrow>03 / Diet planner</Eyebrow>
            <RevealHeadline
              text="A plan with room for real life."
              className="text-3xl font-semibold leading-[1.05] tracking-[-0.04em] text-nl-warm sm:text-4xl md:text-5xl"
            />
          </CopyBlock>

          <CopyBlock progress={progress} from={0.32} to={0.58}>
            <Waterfall
              text="Build meals around your goals, your schedule, and the foods you actually enjoy. Swap without starting over."
              className="max-w-md text-lg leading-relaxed text-nl-warm/85"
            />
          </CopyBlock>

          <CopyBlock progress={progress} from={0.58} to={1} last>
            {(on) => (
              <>
                <p className="mb-5 text-sm uppercase tracking-[0.24em] text-nl-sage">This week</p>
                <WeeklyPlanCard on={on} />
              </>
            )}
          </CopyBlock>
        </div>
      </Stage>
    </section>
  )
}

/* ═══ Chapter 4 — Progress (#progress) — the light interlude ═══════════════ */

const CHART_POINTS = [
  [30, 205],
  [140, 182],
  [250, 192],
  [360, 160],
  [470, 168],
  [580, 138],
  [670, 120],
]
const CHART_LABELS = ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Today"]
const CHART_D =
  "M30 205 C 70 196 105 184 140 182 S 215 194 250 192 S 325 166 360 160 S 435 170 470 168 S 545 142 580 138 S 645 124 670 120"

function NourishmentChart({ on }: { on: boolean }) {
  const reduced = useReducedStable()
  return (
    <figure data-active={on} className="w-full max-w-3xl">
      <svg
        viewBox="0 0 700 285"
        role="img"
        aria-label="Seven-day nourishment trend: a gentle, imperfect rise toward today"
        className="w-full"
      >
        <motion.path
          d={`${CHART_D} L 670 250 L 30 250 Z`}
          className="fill-nl-forest/[0.08]"
          initial={{ opacity: 0 }}
          animate={reduced || on ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: EASE }}
        />
        <path
          d={CHART_D}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="nl-chart-line stroke-nl-forest"
        />
        {CHART_POINTS.slice(0, -1).map(([x, y], i) => (
          <motion.circle
            key={x}
            cx={x}
            cy={y}
            r="3.5"
            className="fill-nl-sage"
            initial={{ opacity: 0, scale: 0 }}
            animate={reduced || on ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
            transition={{ duration: 0.4, delay: 0.35 + i * 0.16, ease: EASE }}
            style={{ transformOrigin: `${x}px ${y}px` }}
          />
        ))}
        <motion.g
          initial={{ opacity: 0, scale: 0 }}
          animate={reduced || on ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
          transition={{ duration: 0.55, delay: 1.35, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ transformOrigin: "670px 120px" }}
        >
          <circle cx="670" cy="120" r="10" className="fill-nl-lime/25" />
          <circle cx="670" cy="120" r="5" className="fill-nl-lime stroke-nl-ink/20" />
        </motion.g>
        {CHART_LABELS.map((l, i) => (
          <motion.text
            key={l}
            x={CHART_POINTS[i][0]}
            y="274"
            textAnchor="middle"
            initial={{ opacity: 0 }}
            animate={reduced || on ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.4 + i * 0.16, ease: EASE }}
            className={cn(
              "text-[13px]",
              i === CHART_LABELS.length - 1 ? "fill-nl-ink font-semibold" : "fill-nl-ink/45"
            )}
          >
            {l}
          </motion.text>
        ))}
      </svg>
    </figure>
  )
}

function ChapterProgress() {
  const track = useTrack()
  const { ref, progress } = track
  return (
    <section
      ref={ref}
      id="progress"
      data-chapter="progress"
      className="relative"
      style={{ height: "360svh" }}
    >
      <Stage track={track}>
        <div className={ZONE_CENTER}>
          <CopyBlock progress={progress} from={0} to={0.4} first>
            <Eyebrow light>04 / Progress, not perfection</Eyebrow>
            <RevealHeadline
              text="Small choices become a pattern."
              className="mx-auto max-w-[15ch] text-3xl font-semibold leading-[1.05] tracking-[-0.04em] text-nl-ink sm:text-4xl md:text-[3.4rem]"
            />
          </CopyBlock>

          <CopyBlock progress={progress} from={0.4} to={1} last className="w-full justify-self-center">
            {(on) => (
              <div className="flex w-full flex-col items-center">
                <NourishmentChart on={on} />
                <motion.p
                  className="mt-8 max-w-md text-center text-base leading-relaxed text-nl-ink/70"
                  initial={{ opacity: 0, y: 12 }}
                  animate={on ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                  transition={{ duration: 0.6, delay: 1.5, ease: EASE }}
                >
                  A clearer picture helps you notice what supports you—without chasing perfection.
                </motion.p>
              </div>
            )}
          </CopyBlock>
        </div>
      </Stage>
    </section>
  )
}

/* ═══ Chapter 5 — Plans (#plans) ═══════════════════════════════════════════ */

const PLANS = [
  {
    name: "Free",
    price: "₹0",
    cadence: "forever",
    features: ["Meal logging", "Basic daily insights", "One plan template"],
    cta: "Start free",
  },
  {
    name: "Plus",
    price: "₹299",
    cadence: "per month",
    features: ["Photo food analysis", "Weekly diet planner", "AI health assistant"],
    cta: "Choose Plus",
  },
  {
    name: "Yearly",
    price: "₹2,499",
    cadence: "per year",
    badge: "Best value",
    features: ["Everything in Plus", "Two months free", "Early access features"],
    cta: "Choose Yearly",
  },
]

/* Each tier owns a progress sub-segment of the plans chapter, so the reveal is
   scroll-driven: Free lands first, then Plus, then Yearly. Cards accumulate —
   grid slots are reserved from the start, so nothing reflows as they appear. */
const PLAN_SEGS: [number, number][] = [
  [0.3, 0.4],
  [0.46, 0.56],
  [0.62, 0.72],
]

function RevealPlanCard({
  plan,
  seg,
  progress,
  isSel,
  onSelect,
}: {
  plan: (typeof PLANS)[number]
  seg: [number, number]
  progress: MotionValue<number>
  isSel: boolean
  onSelect: () => void
}) {
  const reduced = useReducedStable()
  const opacity = useTransform(progress, seg, [0, 1])
  const scale = useTransform(progress, seg, [0.82, 1])
  const visibility = useTransform(opacity, (v) => (v > 0.008 ? "visible" : "hidden"))
  const pointerEvents = useTransform(opacity, (v) => (v > 0.6 ? "auto" : "none"))
  return (
    <motion.div
      style={
        reduced
          ? { opacity, visibility, pointerEvents }
          : { opacity, scale, visibility, pointerEvents }
      }
      className={cn(
        "relative flex flex-col rounded-2xl border p-6 text-left transition-[border-color,box-shadow] duration-500",
        isSel
          ? "border-nl-lime/70 bg-nl-ink/90 shadow-[0_0_40px_rgba(201,255,74,0.08)]"
          : cn(HAIRLINE, "bg-nl-ink/80")
      )}
    >
            <button
              type="button"
              aria-pressed={isSel}
              onClick={onSelect}
              className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              <span className="sr-only">
                Select the {plan.name} plan{isSel ? " (selected)" : ""}
              </span>
            </button>
            {plan.badge && (
              <span className="absolute -top-2.5 right-5 z-10 rounded-full bg-nl-lime px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-nl-ink">
                {plan.badge}
              </span>
            )}
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-nl-sage">
              {plan.name}
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-nl-warm">
              {plan.price}
              <span className="ml-2 text-xs font-normal text-nl-sage">{plan.cadence}</span>
            </p>
            <ul className="mb-6 mt-5 space-y-2.5 text-sm text-nl-warm/80">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <Check
                    className={cn(
                      "size-3.5 shrink-0 transition-colors duration-300",
                      isSel ? "text-nl-lime" : "text-nl-sage"
                    )}
                    aria-hidden="true"
                  />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className={cn(
                "relative z-10 mt-auto rounded-full px-5 py-2.5 text-center text-[13px] font-semibold transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2",
                isSel
                  ? "bg-nl-lime text-nl-ink"
                  : cn("border text-nl-warm hover:border-nl-warm/50", HAIRLINE)
              )}
            >
              {plan.cta}
            </Link>
    </motion.div>
  )
}

function PlanCards({ progress }: { progress: MotionValue<number> }) {
  const [selected, setSelected] = useState(2)
  return (
    <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {PLANS.map((plan, i) => (
        <RevealPlanCard
          key={plan.name}
          plan={plan}
          seg={PLAN_SEGS[i]}
          progress={progress}
          isSel={selected === i}
          onSelect={() => setSelected(i)}
        />
      ))}
    </div>
  )
}

function ChapterPlans() {
  const track = useTrack()
  const { ref, reduced, progress } = track
  const bgOpacity = useTransform(progress, [0, 0.5], [0.12, 0.28])
  return (
    <section
      ref={ref}
      id="plans"
      data-chapter="plans"
      className="relative"
      style={{ height: "580svh" }}
    >
      <Stage track={track}>
        {/* atmospheric right-side backdrop only */}
        <motion.div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 hidden w-1/2 md:block"
          style={reduced ? { opacity: 0.25 } : { opacity: bgOpacity }}
        >
          <ChapterVisual
            src="/nutrilife-landing/subscription-plans.png"
            progress={progress}
            imgClassName="object-right"
            from={1.12}
            to={1.0}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-nl-ink to-nl-ink/40" />
        </motion.div>

        <div className={cn(ZONE_CENTER, "md:px-[10%] lg:px-[12%]")}>
          <CopyBlock progress={progress} from={0} to={0.26} first>
            <Eyebrow>05 / Choose your rhythm</Eyebrow>
            <RevealHeadline
              text="One clear plan. Your pace."
              className="mx-auto max-w-[14ch] text-3xl font-semibold leading-[1.05] tracking-[-0.04em] text-nl-warm sm:text-4xl md:text-5xl"
            />
            <Waterfall
              text="Start simply. Keep the tools that help you stay consistent."
              className="mx-auto mt-5 max-w-sm text-base leading-relaxed text-nl-warm/80"
            />
          </CopyBlock>

          <CopyBlock progress={progress} from={0.26} to={1} last className="w-full justify-self-center">
            <PlanCards progress={progress} />
          </CopyBlock>
        </div>
      </Stage>
    </section>
  )
}

/* ═══ Finale — dashboard reveal (#dashboard) ═══════════════════════════════ */

const cardV = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
}

function DashboardMock() {
  const ringC = 2 * Math.PI * 62
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border bg-nl-ink/92 shadow-2xl md:flex-row",
        HAIRLINE
      )}
    >
      {/* rail */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-5 border-b px-4 py-3 md:w-16 md:flex-col md:border-b-0 md:border-r md:py-6",
          HAIRLINE
        )}
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-nl-lime text-sm font-bold text-nl-ink">
          N
        </span>
        {[Home, Utensils, BarChart3, CalendarDays].map((Icon, i) => (
          <span key={i} className={cn("text-nl-sage", i === 0 && "text-nl-warm")} aria-hidden="true">
            <Icon className="size-[18px]" />
          </span>
        ))}
        <span className="text-nl-sage md:mt-auto" aria-hidden="true">
          <Settings className="size-[18px]" />
        </span>
      </div>

      {/* main */}
      <div className="flex-1 p-5 sm:p-6">
        <motion.div
          variants={cardV}
          className="mb-5 flex flex-wrap items-center justify-between gap-3"
        >
          <div>
            <p className="text-lg font-semibold text-nl-warm">Good morning, Aanya</p>
            <p className="text-xs text-nl-sage">Wednesday, 23 July</p>
          </div>
          <span className="flex items-center gap-2 rounded-full bg-nl-lime px-4 py-2 text-[13px] font-semibold text-nl-ink">
            <Utensils className="size-3.5" aria-hidden="true" />
            Log a meal
          </span>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-3">
          <motion.div
            variants={cardV}
            className={cn("rounded-xl border bg-nl-pine/40 p-5 md:col-span-2", HAIRLINE)}
          >
            <p className="mb-4 text-xs uppercase tracking-[0.2em] text-nl-sage">Today</p>
            <div className="flex flex-wrap items-center gap-6">
              <div className="relative">
                <svg
                  viewBox="0 0 140 140"
                  className="size-32 -rotate-90"
                  role="img"
                  aria-label="Daily nutrition: 68 percent of goal"
                >
                  <circle
                    cx="70"
                    cy="70"
                    r="62"
                    fill="none"
                    strokeWidth="10"
                    className="stroke-nl-warm/10"
                  />
                  <circle
                    cx="70"
                    cy="70"
                    r="62"
                    fill="none"
                    strokeWidth="10"
                    strokeLinecap="round"
                    className="stroke-nl-lime"
                    strokeDasharray={ringC}
                    strokeDashoffset={ringC * 0.32}
                  />
                </svg>
                <span className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-semibold text-nl-warm">68%</span>
                  <span className="text-[10px] text-nl-sage">of goal</span>
                </span>
              </div>
              <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4 text-sm">
                {[
                  ["Calories", "1,284 kcal"],
                  ["Protein", "58 g"],
                  ["Carbs", "142 g"],
                  ["Fats", "38 g"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-nl-sage">{k}</dt>
                    <dd className="font-semibold text-nl-warm">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </motion.div>

          <motion.div variants={cardV} className={cn("rounded-xl border bg-nl-pine/40 p-5", HAIRLINE)}>
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-nl-sage">Next meal</p>
            <p className="font-semibold text-nl-warm">Paneer grain bowl</p>
            <p className="mt-1 text-xs text-nl-sage">Lunch · 1:00 pm</p>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-nl-warm/75">
              <Flame className="size-3.5 text-nl-lime" aria-hidden="true" />
              520 kcal · balanced
            </p>
          </motion.div>

          <motion.div
            variants={cardV}
            className={cn("rounded-xl border bg-nl-pine/40 p-5 md:col-span-2", HAIRLINE)}
          >
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-nl-sage">7-day trend</p>
            <svg
              viewBox="0 0 320 72"
              className="h-16 w-full"
              role="img"
              aria-label="Seven-day energy trend, gently rising"
            >
              <polyline
                points="8,56 60,46 112,50 164,38 216,42 268,26 312,20"
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
                className="stroke-nl-sage"
              />
              <circle cx="312" cy="20" r="4" className="fill-nl-lime" />
            </svg>
          </motion.div>

          <motion.div variants={cardV} className={cn("rounded-xl border bg-nl-pine/40 p-5", HAIRLINE)}>
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-nl-sage">Your plan</p>
            <p className="font-semibold text-nl-warm">Balanced · Week 3</p>
            <p className="mt-1 text-xs text-nl-sage">3 easy swaps left this week</p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function Finale() {
  const track = useTrack()
  const { ref, reduced, progress } = track
  /* The line must be fully gone BEFORE the dashboard rises. Previously the two
     windows overlapped (text faded out to 0.44, dashboard revealed at 0.40), so
     for that stretch the half-faded line sat behind the incoming panel and read
     as text stuck in the background. Text is clear by 0.34; reveal starts 0.38. */
  const textOpacity = useTransform(progress, [0.04, 0.16, 0.28, 0.34], [0, 1, 1, 0])
  const textScale = useTransform(progress, [0.28, 0.34], [1, 0.94])
  const textY = useTransform(progress, [0.28, 0.34], [0, -40])
  const [revealed, setRevealed] = useState(false)
  useMotionValueEvent(progress, "change", (v) => {
    setRevealed(v > 0.38)
  })

  return (
    <section
      ref={ref}
      id="dashboard"
      data-chapter="dashboard"
      className="relative"
      style={{ height: "300svh" }}
    >
      <Stage track={track} last>
        {/* hero image as low-opacity blurred texture only */}
        <div aria-hidden="true" className="absolute inset-0 opacity-[0.07] blur-2xl">
          <Image
            src="/nutrilife-landing/hero-nutrition-orbit.png"
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
        </div>

        {/* lime flare — one brief pass as the reveal begins */}
        {!reduced && (
          <motion.div
            aria-hidden="true"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={revealed ? { opacity: [0, 0.32, 0] } : undefined}
            transition={{ duration: 1, times: [0, 0.35, 1], ease: "easeOut" }}
            style={{
              background:
                "radial-gradient(75% 60% at 50% 62%, rgba(201,255,74,0.5) 0%, transparent 65%)",
            }}
          />
        )}

        {/* Sits above the panel and is pointer-transparent, so it can never be
            overlapped by the dashboard nor swallow a click once faded. */}
        <motion.h2
          style={reduced ? { opacity: textOpacity } : { opacity: textOpacity, scale: textScale, y: textY }}
          className="pointer-events-none absolute inset-x-6 top-1/2 z-30 mx-auto max-w-[18ch] -translate-y-1/2 text-center text-3xl font-semibold leading-[1.05] tracking-[-0.04em] text-nl-warm sm:text-4xl md:text-5xl"
        >
          Everything you notice, in one place.
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: "14%", scale: 0.96 }}
          animate={revealed ? { opacity: 1, y: "0%", scale: 1 } : { opacity: 0 }}
          transition={{ duration: 0.85, ease: EASE }}
          className="relative z-20 flex h-full items-center px-5 sm:px-8"
        >
          <motion.div
            initial="hidden"
            animate={revealed ? "show" : "hidden"}
            transition={{ staggerChildren: 0.04, delayChildren: 0.35 }}
            className="w-full"
          >
            <DashboardMock />
          </motion.div>
        </motion.div>
      </Stage>
    </section>
  )
}

/* ═══ Footer ═══════════════════════════════════════════════════════════════ */

function SiteFooter({ onJump }: { onJump: (id: string) => void }) {
  return (
    <footer
      className={cn("relative z-20 border-t bg-nl-ink text-nl-warm", HAIRLINE)}
    >
      <div className="mx-auto grid max-w-[1400px] gap-10 px-6 py-14 sm:px-10 md:grid-cols-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em]">Nutrilife</p>
          <p className="mt-3 text-sm text-nl-sage">Make every meal count.</p>
        </div>
        <nav aria-label="Footer chapters">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-nl-sage">Chapters</p>
          <ul className="space-y-2 text-sm">
            {NAV.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    onJump(item.id)
                  }}
                  className="text-nl-warm/75 transition-colors hover:text-nl-lime focus-visible:text-nl-lime"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Legal and account">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-nl-sage">More</p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/terms" className="text-nl-warm/75 transition-colors hover:text-nl-lime">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-nl-warm/75 transition-colors hover:text-nl-lime">
                Terms
              </Link>
            </li>
            <li>
              <Link href="/support" className="text-nl-warm/75 transition-colors hover:text-nl-lime">
                Support
              </Link>
            </li>
            <li>
              <Link href="/login" className="text-nl-warm/75 transition-colors hover:text-nl-lime">
                App login
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className={cn("border-t px-6 py-5 text-center text-xs text-nl-sage", HAIRLINE)}>
        © 2026 NutriLife
      </div>
    </footer>
  )
}

/* ═══ Page ═════════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const reduced = useReducedStable()

  const [intro, setIntro] = useState(true)
  const [heroGo, setHeroGo] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [active, setActive] = useState("hero")
  const lenisRef = useRef<Lenis | null>(null)

  /* authenticated visitors go straight to the app */
  useEffect(() => {
    if (!isLoading && isAuthenticated) router.push("/dashboard")
  }, [isAuthenticated, isLoading, router])

  /* Lenis smooth scroll — intercepting the wheel is itself motion the user
     did not ask for, so it stays off under prefers-reduced-motion. */
  useEffect(() => {
    if (reduced) return
    const lenis = new Lenis({
      duration: 1.25,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      wheelMultiplier: 0.92,
      touchMultiplier: 1.6,
    })
    lenisRef.current = lenis
    let raf: number
    const loop = (time: number) => {
      lenis.raf(time)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [reduced])

  /* scroll lock during intro + mobile menu */
  useEffect(() => {
    const lock = intro || menuOpen
    document.documentElement.style.overflow = lock ? "hidden" : ""
    const l = lenisRef.current
    if (l) {
      if (lock) l.stop()
      else l.start()
    }
    return () => {
      document.documentElement.style.overflow = ""
    }
  }, [intro, menuOpen])

  /* active chapter: the section crossing the viewport's center band */
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-chapter]")
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.chapter ?? "hero")
        }
      },
      { rootMargin: "-45% 0px -45% 0px" }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const jump = useCallback((id: string) => {
    const lenis = lenisRef.current
    if (lenis) lenis.scrollTo(`#${id}`, { duration: 1.4 })
    else document.getElementById(id)?.scrollIntoView()
  }, [])

  const onReveal = useCallback(() => setHeroGo(true), [])
  const onIntroDone = useCallback(() => setIntro(false), [])

  const light = active === "progress"

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-svh overflow-x-clip bg-nl-ink font-sans text-nl-warm">
        <Backdrop active={active} />
        {intro && (
          <p role="status" className="sr-only">
            Preparing your nutrition story
          </p>
        )}
        {intro && <IntroOverlay onReveal={onReveal} onDone={onIntroDone} />}
        <SiteHeader active={active} light={light} onJump={jump} onOpenMenu={() => setMenuOpen(true)} />
        {menuOpen && <MobileMenu onClose={() => setMenuOpen(false)} onJump={jump} />}
        <SceneRail active={active} light={light} onJump={jump} />

        <main className="relative">
          <Hero started={heroGo} onCue={() => jump("log")} />
          <ChapterLog />
          <ChapterAnalyze />
          <ChapterPlan />
          <ChapterProgress />
          <ChapterPlans />
          <Finale />
        </main>

        <SiteFooter onJump={jump} />
      </div>
    </MotionConfig>
  )
}
