import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

/** Read-only star rating, e.g. 4.3 → four full stars and one partial. */
export function Stars({ value, size = "sm", className }: { value: number; size?: "xs" | "sm" | "md"; className?: string }) {
  const px = size === "xs" ? "size-3" : size === "md" ? "size-5" : "size-4"
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)))
        return (
          <span key={i} className={cn("relative inline-block", px)} aria-hidden>
            <Star className={cn("absolute inset-0 text-muted-foreground/30", px)} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn("fill-amber-500 text-amber-500", px)} />
            </span>
          </span>
        )
      })}
    </span>
  )
}

/** "★ 4.5 (12)" compact summary for cards and headers; nothing when there are no reviews. */
export function RatingSummary({ avg, count, className }: { avg: number; count: number; className?: string }) {
  if (!count) return null
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] text-muted-foreground", className)} aria-label={`Rated ${avg.toFixed(1)} out of 5 from ${count} review${count === 1 ? "" : "s"}`}>
      <Star className="size-3 fill-amber-500 text-amber-500" aria-hidden />
      <span className="font-semibold text-foreground">{avg.toFixed(1)}</span>
      <span>({count})</span>
    </span>
  )
}
