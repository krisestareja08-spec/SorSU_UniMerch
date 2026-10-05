"use client"

import { useEffect, useState } from "react"
import { BROWSER_ALERTS_KEY, browserAlertsOn } from "./live-alerts"

type State = "unsupported" | "denied" | "on" | "off"

/** Settings switch: lets UniMerch show system notifications while it's open in a background tab. */
export function BrowserAlertsToggle() {
  const [state, setState] = useState<State>("off")

  useEffect(() => {
    const t = setTimeout(() => {
      if (typeof Notification === "undefined") setState("unsupported")
      else if (Notification.permission === "denied") setState("denied")
      else setState(browserAlertsOn() ? "on" : "off")
    }, 0)
    return () => clearTimeout(t)
  }, [])

  async function toggle(on: boolean) {
    if (!on) {
      try { localStorage.setItem(BROWSER_ALERTS_KEY, "off") } catch {}
      setState("off")
      return
    }
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission()
    if (permission !== "granted") { setState(permission === "denied" ? "denied" : "off"); return }
    try { localStorage.setItem(BROWSER_ALERTS_KEY, "on") } catch {}
    setState("on")
    new Notification("Browser alerts are on", { body: "You'll see order and message alerts here while UniMerch is open.", icon: "/icon-light-32x32.png" })
  }

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">Browser alerts</p>
        <p className="text-xs text-muted-foreground">
          {state === "unsupported" ? "This browser doesn't support notifications."
            : state === "denied" ? "Blocked in your browser. Allow notifications for this site in the browser's site settings."
            : "Pop-up alerts for pickups, payments and messages, even when UniMerch is in a background tab."}
        </p>
      </div>
      <label className="relative shrink-0 cursor-pointer">
        <input type="checkbox" role="switch" checked={state === "on"} disabled={state === "unsupported" || state === "denied"}
          onChange={(e) => toggle(e.target.checked)} className="peer sr-only" aria-label="Browser alerts" />
        <div className="h-6 w-11 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-disabled:opacity-50 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30" />
        <div className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </label>
    </div>
  )
}
