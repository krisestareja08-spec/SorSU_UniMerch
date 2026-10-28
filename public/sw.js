/*
 * UniMerch service worker (registered by components/pwa/pwa-register.tsx in production).
 *  • App shell assets (/_next/static, icons) are cached so the installed app opens fast.
 *  • Pages are never cached: they contain personal data (orders, messages). If the network is
 *    down, navigations fall back to /offline.html.
 *  • When the app opens (no UniMerch window yet), the animated launch screen (/launch.html, no
 *    personal data) shows at once from the cache while the page itself loads.
 *  • Handles Web Push messages so notifications can arrive while the app is closed, once push
 *    sending is set up on the server (future work).
 */
const VERSION = "v4"
const STATIC_CACHE = `unimerch-static-${VERSION}`
const PRECACHE = ["/offline.html", "/launch.html", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/badge-96.png", "/sorsu-seal.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("unimerch-") && k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase, Google, analytics: straight to the network

  // Pages: always fresh from the network; offline screen when unreachable
  if (req.mode === "navigate") {
    event.respondWith(openPage(req, url))
    return
  }

  // Build assets are content-hashed and never change, icons rarely: cache first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/sorsu-seal.png") {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy))
        }
        return res
      })),
    )
  }
})

// Pages the launch screen was just shown for (page address → time)
const launched = new Map()

/**
 * A page navigation. On a cold start (the app opened from its icon, a shortcut or a notification,
 * with no UniMerch window open) the launch screen answers at once; it then loads this same page,
 * which finds its window open (or is in `launched`) and goes to the network.
 */
async function openPage(req, url) {
  const recent = launched.get(req.url)
  launched.delete(req.url)
  const coldStart = req.destination === "document" && !url.searchParams.has("nosplash") && !url.pathname.startsWith("/api/")
    && !(recent && Date.now() - recent < 30000)
    && (await self.clients.matchAll({ type: "window", includeUncontrolled: true })).length === 0
  const launch = coldStart && (await caches.match("/launch.html"))
  if (launch) {
    launched.set(req.url, Date.now())
    return launch
  }
  return fetch(req).catch(() => caches.match("/offline.html"))
}

// ── Push notifications ──────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data && event.data.text() } }
  event.waitUntil(self.registration.showNotification(data.title || "UniMerch", {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: data.tag,
    data: { href: data.href || "/marketplace/notifications" },
  }))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.href || "/", self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin))
      if (open) return open.navigate(target).then((w) => (w || open).focus())
      return self.clients.openWindow(target)
    }),
  )
})
