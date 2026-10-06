"use client"

import { WifiOff } from "lucide-react"
import { useOffline } from "next/offline"

/** Shown on every page while the connection is down; Next.js retries pending requests when it returns. */
export function OfflineBanner() {
  const offline = useOffline()
  if (!offline) return null
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-100 flex items-center justify-center gap-2 bg-foreground px-4 py-2 text-center text-xs font-medium text-background shadow-md">
      <WifiOff className="size-3.5 shrink-0" aria-hidden />
      You&apos;re offline. We&apos;ll finish loading as soon as you&apos;re back online.
    </div>
  )
}
