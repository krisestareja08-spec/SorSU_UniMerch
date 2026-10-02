"use client"

import { useEffect, useState } from "react"
import { THEME_STORAGE_KEY as STORAGE_KEY, type ThemeChoice } from "@/lib/theme"

/** Applied before paint by THEME_SCRIPT in the root layout, and on every change here. */
function applyTheme(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  const root = document.documentElement
  root.classList.toggle("dark", dark)
  root.classList.toggle("light", !dark)
}

export function ThemeSelect() {
  const [choice, setChoice] = useState<ThemeChoice>("system")

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      // localStorage is only readable after mount, so state can't be initialised from it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === "light" || saved === "dark" || saved === "system") setChoice(saved)
    } catch {}
  }, [])

  // Follow the device while on "system".
  useEffect(() => {
    if (choice !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => applyTheme("system")
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [choice])

  function onSelect(next: ThemeChoice) {
    setChoice(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
    applyTheme(next)
  }

  return (
    <select value={choice} onChange={(e) => onSelect(e.target.value as ThemeChoice)} aria-label="Theme"
      className="h-9 shrink-0 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20">
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  )
}
