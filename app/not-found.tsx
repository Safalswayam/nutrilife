import Link from "next/link"

/* Next's built-in 404 is styled for a light background — black text on our ink
   ground measured 1.1:1. This replaces it in the product's own palette. */
export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-6 text-center">
      <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.3em] text-primary">404</p>
      <h1 className="max-w-[18ch] text-3xl font-semibold leading-[1.1] tracking-[-0.04em] text-foreground sm:text-4xl">
        That page isn&apos;t on the menu.
      </h1>
      <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
        The link may be out of date, or the page may have moved.
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/dashboard"
          className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform duration-300 hover:scale-[1.04] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Go to dashboard
        </Link>
        <Link
          href="/"
          className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground focus-visible:text-foreground"
        >
          Back to home
        </Link>
      </div>
    </main>
  )
}
