"use client"

import { useEffect, useState } from "react"
import { BadgeCheck, Loader2, Pencil, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Stars } from "./stars"

const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"]
type Review = { id: string; rating: number; comment: string | null }

/** Rate one item of a completed order. Only verified buyers pass the database check (scripts/26). */
export function ReviewForm({ orderId, productId, sellerId, productName }: { orderId: string; productId: string; sellerId: string; productName: string }) {
  const [existing, setExisting] = useState<Review | null | undefined>(undefined)
  const [editing, setEditing] = useState(false)
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    createClient().from("product_reviews").select("id, rating, comment").eq("order_id", orderId).eq("product_id", productId).maybeSingle()
      .then(({ data, error: err }) => {
        if (err) { setError(err.message.includes("product_reviews") ? "Reviews aren't set up yet. Run scripts/26_reviews_banners_cart.sql." : err.message); setExisting(null); return }
        setExisting(data)
        if (data) { setRating(data.rating); setComment(data.comment ?? "") }
      })
  }, [orderId, productId])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!rating) { setError("Choose a star rating."); return }
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setBusy(false); return }
    const body = { rating, comment: comment.trim() || null }
    const { data, error: err } = existing
      ? await supabase.from("product_reviews").update(body).eq("id", existing.id).select("id, rating, comment").single()
      : await supabase.from("product_reviews").insert({ ...body, order_id: orderId, product_id: productId, seller_id: sellerId, buyer_id: user.id }).select("id, rating, comment").single()
    setBusy(false)
    if (err) { setError(err.message.includes("row-level security") ? "Only items from completed orders can be reviewed." : err.message); return }
    setExisting(data)
    setEditing(false)
  }

  if (existing === undefined) return <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />

  if (existing && !editing) {
    return (
      <div className="rounded-xl bg-muted/40 p-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Stars value={existing.rating} /><span className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400"><BadgeCheck className="size-3.5" />Your review</span></span>
          <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"><Pencil className="size-3" />Edit</button>
        </div>
        {existing.comment && <p className="mt-1.5 whitespace-pre-line text-muted-foreground">{existing.comment}</p>}
      </div>
    )
  }

  const shown = hover || rating
  return (
    <form onSubmit={save} className="space-y-2 rounded-xl border border-gold/30 bg-gold/5 p-3">
      <fieldset>
        <legend className="mb-1 text-xs font-medium">Rate {productName}</legend>
        <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" onClick={() => setRating(i)} onMouseEnter={() => setHover(i)}
              aria-label={`${i} star${i === 1 ? "" : "s"} — ${LABELS[i]}`} aria-pressed={rating === i}
              className="rounded p-0.5 focus-visible:outline-2 focus-visible:outline-primary">
              <Star className={cn("size-6 transition-colors", i <= shown ? "fill-amber-500 text-amber-500" : "text-muted-foreground/40")} />
            </button>
          ))}
          <span className="ml-2 text-xs text-muted-foreground" aria-live="polite">{LABELS[shown]}</span>
        </div>
      </fieldset>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={2} aria-label="Review comment (optional)"
        placeholder="How was the quality, fit and pickup? (optional)"
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20" />
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>{busy && <Loader2 className="size-3.5 animate-spin" />}{existing ? "Update review" : "Submit review"}</Button>
        {existing && <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(false); setRating(existing.rating); setComment(existing.comment ?? "") }}>Cancel</Button>}
      </div>
    </form>
  )
}
