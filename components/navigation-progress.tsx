"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

/**
 * Thin gold loading bar at the top of the screen: starts as soon as an internal link is tapped and
 * finishes when the new page is showing, so people know their tap registered while the next page loads.
 */
function ProgressBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState<number | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const trickle = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  function clear() {
    timers.current.forEach(clearTimeout)
    timers.current = []
    clearInterval(trickle.current)
  }

  function start() {
    clear()
    setProgress(8)
    // Creep towards 90% while waiting; the last 10% happens when the page arrives
    trickle.current = setInterval(() => setProgress((p) => (p === null ? p : Math.min(90, p + (90 - p) * 0.12))), 200)
    // Never get stuck (e.g. the navigation was cancelled)
    timers.current.push(setTimeout(done, 15000))
  }

  function done() {
    clear()
    setProgress((p) => (p === null ? null : 100))
    timers.current.push(setTimeout(() => setProgress(null), 250))
  }

  // A new page is showing
  // eslint-disable-next-line react-hooks/exhaustive-deps -- finish on every route change
  useEffect(() => { done() }, [pathname, searchParams])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      // (Not e.defaultPrevented: Next.js <Link> prevents the browser navigation to do its own)
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin) return
      // Same page (or just a #section on it): nothing to load
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      start()
    }
    document.addEventListener("click", onClick)
    return () => {
      document.removeEventListener("click", onClick)
      clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listen once
  }, [])

  if (progress === null) return null
  return (
    <div role="progressbar" aria-label="Loading page" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}
      className="pointer-events-none fixed inset-x-0 top-0 z-110 h-0.75">
      <div className="h-full bg-gold shadow-[0_0_8px_var(--color-gold)] transition-[width,opacity] duration-200 ease-out motion-reduce:transition-none"
        style={{ width: `${progress}%`, opacity: progress >= 100 ? 0 : 1 }} />
    </div>
  )
}

export function NavigationProgress() {
  // useSearchParams needs a Suspense boundary in the root layout
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  )
}
