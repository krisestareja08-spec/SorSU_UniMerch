"use client"

import { useEffect, useRef, useSyncExternalStore } from "react"
import { usePathname } from "next/navigation"

/**
 * Menu number badges, kept between pages so they don't flicker: loaded after a page shows, again
 * when the page changes (at most every few seconds), when the tab regains focus, and every minute.
 */
type Badges = Record<string, number>
const EMPTY: Badges = {}
const store = new Map<string, Badges>()
const lastLoad = new Map<string, number>()
const listeners = new Set<() => void>()
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }

export function useBadges(key: string | null, load: () => Promise<Badges>): Badges {
  const pathname = usePathname()
  const loader = useRef(load)
  useEffect(() => { loader.current = load })
  const badges = useSyncExternalStore(subscribe, () => (key ? store.get(key) ?? EMPTY : EMPTY), () => EMPTY)

  useEffect(() => {
    if (!key) return
    const run = (force = false) => {
      if (!force && Date.now() - (lastLoad.get(key) ?? 0) < 5000) return
      lastLoad.set(key, Date.now())
      loader.current().then((b) => { store.set(key, b ?? EMPTY); listeners.forEach((l) => l()) }).catch(() => {})
    }
    run()
    const onFocus = () => run()
    window.addEventListener("focus", onFocus)
    const t = setInterval(() => run(true), 60000)
    return () => { window.removeEventListener("focus", onFocus); clearInterval(t) }
  }, [key, pathname])

  return badges
}

/** "99+" for big numbers */
export const badgeText = (n: number) => (n > 99 ? "99+" : String(n))
