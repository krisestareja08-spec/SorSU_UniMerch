"use client"

import { Suspense, useEffect, useSyncExternalStore } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * In-app Back / Forward. Browsers don't say whether there is a page to go back or forward to, so this
 * keeps its own list of the pages visited in this tab (sessionStorage) and where in it we are:
 *  • a new page → added after the current one (anything "ahead" is dropped, like the browser does)
 *  • browser/our Back or Forward (popstate) → we move along the list instead of adding
 * Back goes to the page you were actually on; with nothing before it (link opened directly), it goes
 * to the page's parent instead. Forward appears only after going back.
 */

type Trail = { entries: string[]; pos: number }
const KEY = "unimerch-nav-trail"
const MAX = 60

let trail: Trail = { entries: [], pos: -1 }
let popTarget: string | null = null
const listeners = new Set<() => void>()

function load() {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) {
      const t = JSON.parse(raw) as Trail
      if (Array.isArray(t.entries) && typeof t.pos === "number") trail = t
    }
  } catch {}
}
function save() {
  try { sessionStorage.setItem(KEY, JSON.stringify(trail)) } catch {}
}
function emit() {
  snapshot = { canGoBack: trail.pos > 0, canGoForward: trail.pos >= 0 && trail.pos < trail.entries.length - 1 }
  listeners.forEach((l) => l())
}

/** Record that the page `url` is now showing. */
function record(url: string) {
  const { entries, pos } = trail
  // Only a Back/Forward that landed on this very page counts (a #section Back doesn't change the page)
  const wasPop = popTarget === url
  popTarget = null
  if (entries[pos] === url) return // same page (refresh, or a no-op replace)
  if (wasPop) {
    // Moved with Back / Forward: find the entry nearest to where we were
    if (entries[pos - 1] === url) trail = { entries, pos: pos - 1 }
    else if (entries[pos + 1] === url) trail = { entries, pos: pos + 1 }
    else {
      let best = -1
      entries.forEach((e, i) => { if (e === url && (best < 0 || Math.abs(i - pos) < Math.abs(best - pos))) best = i })
      trail = best >= 0 ? { entries, pos: best } : { entries: [...entries.slice(0, pos + 1), url].slice(-MAX), pos: Math.min(pos + 1, MAX - 1) }
    }
  } else {
    const next = [...entries.slice(0, pos + 1), url].slice(-MAX)
    trail = { entries: next, pos: next.length - 1 }
  }
  save()
  emit()
}

let snapshot = { canGoBack: false, canGoForward: false }
const serverSnapshot = { canGoBack: false, canGoForward: false }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }

export function useNavHistory() {
  return useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot)
}

function Tracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const query = searchParams.toString()
  const url = query ? `${pathname}?${query}` : pathname

  useEffect(() => {
    load()
    emit()
    // Know it's a Back/Forward before the new page is recorded. Browsers with the Navigation API
    // announce it ("traverse") before Next.js shows the page; older ones only fire popstate.
    type NavEvent = Event & { navigationType?: string; destination?: { url: string } }
    const nav = (window as unknown as { navigation?: EventTarget }).navigation
    const onNavigate = (e: Event) => {
      const ev = e as NavEvent
      if (ev.navigationType === "traverse" && ev.destination) {
        const u = new URL(ev.destination.url)
        popTarget = u.pathname + u.search
      }
    }
    const onPop = () => { popTarget = location.pathname + location.search }
    nav?.addEventListener("navigate", onNavigate)
    window.addEventListener("popstate", onPop, { capture: true })
    return () => {
      nav?.removeEventListener("navigate", onNavigate)
      window.removeEventListener("popstate", onPop, { capture: true })
    }
  }, [])

  useEffect(() => { record(url) }, [url])
  return null
}

/** Mount once (root layout): keeps the list of visited pages up to date. */
export function NavHistoryTracker() {
  return <Suspense fallback={null}><Tracker /></Suspense>
}

/** Back + Forward buttons for page headers. `fallbackHref`: where Back goes when there is no earlier page. */
export function HistoryButtons({ fallbackHref, tone = "light", className }: { fallbackHref: string; tone?: "light" | "dark"; className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const { canGoBack, canGoForward } = useNavHistory()
  const showBack = canGoBack || pathname !== fallbackHref
  const btn = cn(
    // Narrower on phones so the header's search box keeps its room (still a full-height tap target)
    "flex h-9 w-7 shrink-0 items-center justify-center rounded-lg transition-colors active:scale-95 sm:w-9",
    tone === "dark" ? "text-primary-foreground/85 hover:bg-primary-foreground/10" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  )
  if (!showBack && !canGoForward) return null
  return (
    <div className={cn("flex items-center", className)}>
      {showBack && (
        <button type="button" className={btn} aria-label="Go back" title="Back"
          onClick={() => (canGoBack ? router.back() : router.push(fallbackHref))}>
          <ChevronLeft className="size-5" />
        </button>
      )}
      {canGoForward && (
        <button type="button" className={btn} aria-label="Go forward" title="Forward" onClick={() => router.forward()}>
          <ChevronRight className="size-5" />
        </button>
      )}
    </div>
  )
}

/** An in-page "Back" link: returns to the previous page, or to `href` when there isn't one. */
export function BackLink({ href, label = "Back", className }: { href: string; label?: string; className?: string }) {
  const router = useRouter()
  const { canGoBack } = useNavHistory()
  return (
    <a href={href}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return // let "open in new tab" work
        e.preventDefault()
        if (canGoBack) router.back()
        else router.push(href)
      }}
      className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground", className)}>
      <ArrowLeft className="size-4" /> {label}
    </a>
  )
}
