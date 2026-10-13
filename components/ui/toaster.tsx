"use client"

import { useEffect, useSyncExternalStore } from "react"
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Small toast notifications: `toast({ title, description })` from any client component; <Toaster />
 * (mounted once in the root layout) shows them at the bottom of the screen for a few seconds.
 */

type ToastVariant = "success" | "info" | "error"
type ToastItem = { id: number; title: string; description?: string; variant: ToastVariant; duration: number }

let items: ToastItem[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function toast(t: { title: string; description?: string; variant?: ToastVariant; duration?: number }) {
  const item: ToastItem = { id: nextId++, title: t.title, description: t.description, variant: t.variant ?? "success", duration: t.duration ?? 5000 }
  items = [...items, item].slice(-3) // at most three at once
  emit()
  return item.id
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id)
  emit()
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const EMPTY: ToastItem[] = []

const ICON = { success: CheckCircle2, info: Info, error: AlertCircle }
const TONE = {
  success: "text-emerald-600 dark:text-emerald-400",
  info: "text-primary dark:text-gold",
  error: "text-destructive",
}

function ToastCard({ t }: { t: ToastItem }) {
  useEffect(() => {
    const timer = setTimeout(() => dismissToast(t.id), t.duration)
    return () => clearTimeout(timer)
  }, [t.id, t.duration])
  const Icon = ICON[t.variant]
  return (
    <div role={t.variant === "error" ? "alert" : "status"}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-border bg-card p-3.5 text-card-foreground shadow-xl animate-in fade-in slide-in-from-bottom-2">
      <Icon className={cn("mt-0.5 size-5 shrink-0", TONE[t.variant])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{t.title}</p>
        {t.description && <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>}
      </div>
      <button type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss notification"
        className="-mr-1 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
    </div>
  )
}

/** Mount once (root layout). Sits above the phone's bottom tab bar. */
export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => EMPTY)
  if (list.length === 0) return null
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-20 z-80 mx-auto flex max-w-sm flex-col gap-2 sm:bottom-6 print:hidden">
      {list.map((t) => <ToastCard key={t.id} t={t} />)}
    </div>
  )
}
