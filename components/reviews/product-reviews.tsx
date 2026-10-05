import { BadgeCheck, MessageSquareText } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Stars } from "./stars"

type Row = { id: string; rating: number; comment: string | null; created_at: string; reviewer: string; mine: boolean }

/** Product page: average, star breakdown and the latest verified reviews. */
export async function ProductReviews({ productId }: { productId: string }) {
  const supabase = await createClient()
  const [{ data: list, error }, { data: all }] = await Promise.all([
    supabase.rpc("product_review_list", { p_product: productId, p_limit: 20 }),
    supabase.from("product_reviews").select("rating").eq("product_id", productId),
  ])
  if (error) return null // scripts/26 not run yet

  const ratings = (all ?? []).map((r) => r.rating as number)
  const count = ratings.length
  const avg = count ? ratings.reduce((s, r) => s + r, 0) / count : 0
  const reviews = (list ?? []) as Row[]

  return (
    <section id="reviews" className="mt-10 scroll-mt-24" aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="font-serif text-lg font-semibold">Ratings &amp; Reviews</h2>
      <div className="mb-4 mt-1.5 h-px bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />

      {count === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          <MessageSquareText className="size-5 shrink-0 text-muted-foreground/50" />
          No reviews yet. Buyers can rate this product after their order is completed.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <p className="font-serif text-4xl font-bold">{avg.toFixed(1)}</p>
            <Stars value={avg} size="md" className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">{count} verified review{count === 1 ? "" : "s"}</p>
            <dl className="mt-4 space-y-1">
              {[5, 4, 3, 2, 1].map((n) => {
                const c = ratings.filter((r) => r === n).length
                return (
                  <div key={n} className="flex items-center gap-2 text-xs">
                    <dt className="w-3 text-muted-foreground">{n}</dt>
                    <dd className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-label={`${c} ${n}-star review${c === 1 ? "" : "s"}`}>
                      <span className="block h-full rounded-full bg-amber-500" style={{ width: `${(c / count) * 100}%` }} />
                    </dd>
                    <span className="w-5 text-right text-muted-foreground">{c}</span>
                  </div>
                )
              })}
            </dl>
          </div>

          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Stars value={r.rating} size="xs" />
                    <span className="text-sm font-medium">{r.mine ? "You" : r.reviewer}</span>
                    <span className="flex items-center gap-0.5 text-[11px] text-emerald-700 dark:text-emerald-400"><BadgeCheck className="size-3.5" />Verified purchase</span>
                  </div>
                  <time dateTime={r.created_at} className="text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                  </time>
                </div>
                {r.comment && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{r.comment}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
