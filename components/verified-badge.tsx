import { BadgeCheck, UserRound } from "lucide-react"
import { AFFILIATION_LABELS, type Affiliation } from "@/lib/roles"
import { cn } from "@/lib/utils"

/** Verified users show "Verified · <affiliation>"; everyone else is a Guest. */
export function VerifiedBadge({
  verified,
  affiliation,
  className,
}: {
  verified: boolean | null | undefined
  affiliation?: string | null
  className?: string
}) {
  const label = AFFILIATION_LABELS[affiliation as Affiliation]
  if (verified && label && affiliation !== "external") {
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", className)}>
        <BadgeCheck className="size-3.5" aria-hidden />
        Verified · {label}
      </span>
    )
  }
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground", className)}>
      <UserRound className="size-3.5" aria-hidden />
      Guest
    </span>
  )
}
