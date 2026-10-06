/** Install-to-home-screen state shared by every "Install app" button. */

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

let deferred: InstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

/** Called once from the root layout; Chrome/Edge/Android fire beforeinstallprompt early. */
export function captureInstallPrompt() {
  const onPrompt = (e: Event) => { e.preventDefault(); deferred = e as InstallPromptEvent; notify() }
  const onInstalled = () => { deferred = null; installed = true; notify() }
  window.addEventListener("beforeinstallprompt", onPrompt)
  window.addEventListener("appinstalled", onInstalled)
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt)
    window.removeEventListener("appinstalled", onInstalled)
  }
}

export type InstallState = "installed" | "ready" | "ios" | "manual"

export function getInstallState(): InstallState {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (installed || standalone) return "installed"
  if (deferred) return "ready"
  // iPhone/iPad Safari has no install prompt; iPadOS reports itself as a Mac with touch
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  return ios ? "ios" : "manual"
}

export function subscribeInstall(callback: () => void) {
  listeners.add(callback)
  return () => { listeners.delete(callback) }
}

/**
 * Shows a system notification. Android Chrome (and installed apps) only allow this through the
 * service worker; plain `new Notification()` is the fallback for desktop browsers without one.
 */
export async function showSystemNotification(title: string, body: string | null, href: string | null, tag?: string) {
  const options = { body: body ?? undefined, tag, icon: "/icons/icon-192.png", badge: "/icons/badge-96.png", data: { href: href ?? "/marketplace/notifications" } }
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    if (reg) { await reg.showNotification(title, options); return }
    const n = new Notification(title, options)
    n.onclick = () => { window.focus(); if (href) window.location.assign(href); n.close() }
  } catch {
    // Notifications blocked or unsupported: the in-app toast still shows
  }
}

/** Shows the browser's install dialog; returns true if the user accepted. */
export async function promptInstall() {
  if (!deferred) return false
  const event = deferred
  deferred = null
  await event.prompt()
  const { outcome } = await event.userChoice
  if (outcome === "accepted") installed = true
  notify()
  return outcome === "accepted"
}
