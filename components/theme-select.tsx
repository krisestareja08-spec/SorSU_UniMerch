"use client"

import { useSyncExternalStore } from "react"
import { Moon, Sun } from "lucide-react"
import { getTheme, setTheme, subscribeTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

/** Current theme; renders "light" on the server and before hydration (the default). */
function useTheme() {
  return useSyncExternalStore(subscribeTheme, getTheme, () => "light" as const)
}

/** Sun / moon icon button for headers. */
export function ThemeToggle({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const dark = useTheme() === "dark"
  return (
    <button type="button" onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={dark} title={dark ? "Light mode" : "Dark mode"}
      className={cn("rounded-lg p-2 transition-colors active:scale-95",
        tone === "dark" ? "text-primary-foreground/80 hover:bg-primary-foreground/10" : "text-muted-foreground hover:bg-muted hover:text-foreground", className)}>
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  )
}

/** On/off switch for the Settings page. */
export function ThemeSwitch() {
  const dark = useTheme() === "dark"
  return (
    <label className="relative shrink-0 cursor-pointer">
      <input type="checkbox" role="switch" checked={dark} onChange={(e) => setTheme(e.target.checked ? "dark" : "light")} className="peer sr-only" aria-label="Dark mode" />
      <div className="h-6 w-11 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30" />
      <div className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
    </label>
  )
}
