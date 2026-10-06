"use client"

import { useState, useSyncExternalStore } from "react"
import { CheckCircle2, Download, Share, SquarePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getInstallState, promptInstall, subscribeInstall, type InstallState } from "@/lib/pwa"
import { cn } from "@/lib/utils"

function useInstallState() {
  // "installed" on the server so nothing install-related flashes before hydration
  return useSyncExternalStore(subscribeInstall, getInstallState, () => "installed" as InstallState)
}

/** Settings row: install button (Chrome/Edge/Android) or Add-to-Home-Screen steps (iPhone/iPad). */
export function InstallAppRow() {
  const state = useInstallState()
  const [showSteps, setShowSteps] = useState(false)

  return (
    <div className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Install UniMerch</p>
          <p className="text-xs text-muted-foreground">
            {state === "installed" ? "UniMerch is installed on this device." : "Add UniMerch to your home screen or desktop and open it like an app."}
          </p>
        </div>
        {state === "installed" ? (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="size-4" />Installed</span>
        ) : state === "ready" ? (
          <Button size="sm" onClick={() => promptInstall()} className="gap-1.5"><Download className="size-4" />Install app</Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setShowSteps((s) => !s)} aria-expanded={showSteps}>How to install</Button>
        )}
      </div>
      {showSteps && state !== "installed" && <InstallSteps ios={state === "ios"} className="mt-3" />}
    </div>
  )
}

/** Compact item for the mobile menu; hidden once installed or when the browser can't install. */
export function InstallAppMenuItem({ onDone }: { onDone?: () => void }) {
  const state = useInstallState()
  if (state !== "ready") return null
  return (
    <button type="button" onClick={() => { onDone?.(); promptInstall() }}
      className="group flex w-full items-center gap-3 px-5 py-3 text-sm text-primary-foreground/80 transition-colors hover:bg-primary-foreground/8 hover:text-primary-foreground">
      <Download className="size-5 shrink-0 text-gold/60 group-hover:text-gold/80" />
      <span className="flex-1 text-left font-medium">Install app</span>
    </button>
  )
}

function InstallSteps({ ios, className }: { ios: boolean; className?: string }) {
  return (
    <ol className={cn("list-decimal space-y-1.5 rounded-xl bg-muted/50 p-3 pl-8 text-xs text-muted-foreground", className)}>
      {ios ? (
        <>
          <li>Open UniMerch in <strong className="text-foreground">Safari</strong>.</li>
          <li>Tap the <Share className="inline size-3.5 align-text-bottom" aria-label="Share" /> <strong className="text-foreground">Share</strong> button.</li>
          <li>Choose <SquarePlus className="inline size-3.5 align-text-bottom" aria-hidden /> <strong className="text-foreground">Add to Home Screen</strong>, then <strong className="text-foreground">Add</strong>.</li>
        </>
      ) : (
        <>
          <li>Open the browser menu (⋮ or ⋯).</li>
          <li>Choose <strong className="text-foreground">Install UniMerch</strong> or <strong className="text-foreground">Add to Home screen</strong>.</li>
          <li>If you don&apos;t see it, open UniMerch in Chrome or Edge and try again.</li>
        </>
      )}
    </ol>
  )
}
