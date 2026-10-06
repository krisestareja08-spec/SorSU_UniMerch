"use client"

import { useEffect } from "react"
import { captureInstallPrompt } from "@/lib/pwa"

/**
 * Registers the service worker (public/sw.js) in production and remembers the browser's install
 * prompt so "Install app" buttons can use it later. In development any old worker is removed so
 * it never serves stale files while you code.
 */
export function PwaRegister() {
  useEffect(() => {
    const stop = captureInstallPrompt()
    if (!("serviceWorker" in navigator)) return stop

    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {})
    } else {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()))
    }
    return stop
  }, [])

  return null
}
