/**
 * Light is the default; the device's dark-mode setting is ignored. Dark mode is only ever an
 * explicit choice (header toggle or Settings), and signing in or out resets it to light.
 */
export type ThemeChoice = "light" | "dark"
const THEME_STORAGE_KEY = "theme"
const THEME_EVENT = "unimerch-theme"

/** Runs in <head> before paint so the saved theme applies without a flash. */
export const THEME_SCRIPT = `(function(){try{var d=localStorage.getItem("${THEME_STORAGE_KEY}")==="dark";var c=document.documentElement.classList;c.toggle("dark",d);c.toggle("light",!d)}catch(e){}})()`

export function getTheme(): ThemeChoice {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light"
  } catch {
    return "light"
  }
}

export function setTheme(choice: ThemeChoice) {
  try { localStorage.setItem(THEME_STORAGE_KEY, choice) } catch {}
  const root = document.documentElement
  root.classList.toggle("dark", choice === "dark")
  root.classList.toggle("light", choice !== "dark")
  window.dispatchEvent(new CustomEvent(THEME_EVENT))
}

/** Called on sign-in and sign-out: every session starts in light mode. */
export function resetTheme() {
  setTheme("light")
}

/** Notifies every toggle on the page when the theme changes (header + Settings stay in sync). */
export function subscribeTheme(callback: () => void) {
  // Another tab changed it: apply here too
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_STORAGE_KEY) return
    const dark = getTheme() === "dark"
    document.documentElement.classList.toggle("dark", dark)
    document.documentElement.classList.toggle("light", !dark)
    callback()
  }
  window.addEventListener(THEME_EVENT, callback)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(THEME_EVENT, callback)
    window.removeEventListener("storage", onStorage)
  }
}
