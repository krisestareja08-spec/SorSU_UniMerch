"use client"

import { useEffect, useId, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * A focused pop-up for one task (a request, a stock change, a quote). On phones it slides up as a
 * bottom sheet; on larger screens it's centred. Escape or the backdrop closes it, the page behind
 * doesn't scroll, and the first field gets focus.
 */
export function Dialog({ open, onClose, title, description, header, children, footer, size = "md" }: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  /** Shown under the title, e.g. the product being changed */
  header?: ReactNode
  children: ReactNode
  /** Sticky action row */
  footer?: ReactNode
  size?: "sm" | "md" | "lg"
}) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  // The latest onClose, so opening the dialog sets it up once (and doesn't steal focus on re-renders)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close.current() }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    // Focus the first field (or the panel) for keyboard and screen-reader users
    const t = setTimeout(() => {
      const first = panel.current?.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]), textarea, select")
      ;(first ?? panel.current)?.focus()
    }, 30)
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; clearTimeout(t) }
  }, [open])

  if (!open || typeof document === "undefined") return null
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="presentation">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-card shadow-2xl outline-none sm:rounded-2xl",
          size === "sm" ? "sm:max-w-sm" : size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}>
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" aria-hidden />
        <div className="flex items-start gap-3 border-b border-border px-5 pb-3 pt-3 sm:pt-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-serif text-lg font-semibold leading-tight">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>
        {header && <div className="border-b border-border bg-muted/30 px-5 py-3">{header}</div>}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center gap-2 border-t border-border bg-card px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
