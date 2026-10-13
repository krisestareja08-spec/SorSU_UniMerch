"use client"

import Link from "next/link"
import { BadgeCheck, ChevronRight, Clock, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Where a buyer stands with identity verification (profiles.verification_status / is_identity_verified):
 *   none — never applied · pending — under review · redo — declined, can reapply · verified — done
 */
export type VerificationState = "none" | "pending" | "redo" | "verified"

export function verificationState(p: { is_identity_verified?: boolean | null; verification_status?: string | null } | null): VerificationState {
  if (p?.is_identity_verified) return "verified"
  if (p?.verification_status === "pending") return "pending"
  if (p?.verification_status === "rejected") return "redo"
  return "none"
}

/**
 * "Apply for verification" at the top of the menu (desktop sidebar and phone menu). Shows the review
 * status while pending, "Reapply" when declined, and disappears once the person is verified.
 */
export function VerificationNavItem({ state, layout, onNavigate }: { state: VerificationState; layout: "sidebar" | "drawer"; onNavigate?: () => void }) {
  if (state === "verified") return null
  const drawer = layout === "drawer"

  if (state === "pending") {
    return (
      <div className={cn("flex items-center gap-3 rounded-xl border border-primary-foreground/15 text-primary-foreground/80", drawer ? "mx-4 mb-2 px-3 py-2.5" : "mx-2 mb-1 px-3 py-2.5")}>
        <Clock className="size-4 shrink-0 text-gold/70" />
        <span className="min-w-0 leading-tight">
          <span className="block text-sm font-medium">Verification under review</span>
          <span className="block text-[11px] text-primary-foreground/55">We&apos;ll notify you when it&apos;s done</span>
        </span>
      </div>
    )
  }

  const redo = state === "redo"
  const Icon = redo ? RotateCcw : BadgeCheck
  return (
    <Link href="/verify" onClick={onNavigate}
      className={cn("group flex items-center gap-3 rounded-xl bg-gold px-3 py-2.5 text-primary shadow-sm transition-colors hover:bg-gold/90",
        drawer ? "mx-4 mb-2" : "mx-2 mb-1")}>
      <Icon className="size-5 shrink-0" />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-sm font-semibold">{redo ? "Reapply for verification" : "Apply for verification"}</span>
        <span className="block text-[11px] text-primary/75">{redo ? "Update your documents" : "Unlock restricted items"}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 opacity-60 group-hover:opacity-100" />
    </Link>
  )
}
