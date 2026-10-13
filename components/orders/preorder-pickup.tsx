"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, CalendarCheck, CalendarDays, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { peso } from "@/lib/order-status"

/** Today / a deadline's day as YYYY-MM-DD in Philippine time */
const manilaDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })
const pretty = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })

/**
 * Pre-orders (scripts/29): once the shop marks the pre-order Ready for Pick Up, the buyer chooses to
 * pick it up today or on a day up to the shop's deadline. Before that, it explains what comes next.
 */
export function PreorderPickup({ order }: {
  order: { id: string; status: string; total: number; amountPaid: number | null; pickupDate: string | null; pickupDeadline: string | null; paymentMethod: string }
}) {
  const router = useRouter()
  const [date, setDate] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const paid = order.amountPaid ?? 0
  const balance = Math.max(0, order.total - paid)
  const today = manilaDay(new Date())
  const lastDay = order.pickupDeadline ? manilaDay(new Date(order.pickupDeadline)) : null
  const missed = !!order.pickupDeadline && new Date(order.pickupDeadline) < new Date()

  function choose(day: string) {
    setError(null)
    startTransition(async () => {
      const { error: err } = await createClient().rpc("set_preorder_pickup", { p_order: order.id, p_date: day })
      if (err) setError(err.message)
      else { setDate(""); router.refresh() }
    })
  }

  const balanceNote = balance > 0 && (
    <p className="mt-2 text-xs text-foreground">
      <span className="font-semibold">Balance to pay before claiming: {peso(balance)}</span>
      {paid > 0 && <span className="text-muted-foreground"> · {peso(paid)} paid</span>}
    </p>
  )

  if (order.status === "pending" || order.status === "paid" || order.status === "partially_paid") {
    return (
      <div className="rounded-xl border border-gold/30 bg-gold/8 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-foreground"><CalendarDays className="size-4 text-gold" />Pre-order</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {order.status === "pending"
            ? order.paymentMethod === "cash"
              ? "The shop is checking your I.D. You can pay at the counter any time (full or half). Paid pre-orders are served first."
              : "The shop is checking your I.D. and payment receipt."
            : "Payment recorded. You're in the queue. When your items arrive, you'll be notified to choose your pick-up day."}
        </p>
        {balanceNote}
      </div>
    )
  }
  if (order.status !== "ready_for_pickup") return null

  if (missed) {
    return (
      <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="size-4" />Pick-up day missed</p>
        <p className="mt-1 text-xs text-muted-foreground">Message the shop below to arrange a new pick-up day or a refund.</p>
        {balanceNote}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/5">
      {order.pickupDate ? (
        <>
          <p className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300"><CalendarCheck className="size-4" />Pick-up day: {pretty(order.pickupDate)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Bring your I.D. and order number. If you don&apos;t pick it up by the end of that day{paid > 0 ? ", the shop will contact you" : ", the pre-order is cancelled and the shop's penalty is added"}.</p>
          {order.pickupDate > today && (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Button size="sm" variant="outline" disabled={pending} onClick={() => choose(today)}>Pick up today instead</Button>
              <Input type="date" min={today} max={order.pickupDate} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Earlier pick-up day" className="h-8 w-40 text-xs" />
              <Button size="sm" variant="outline" disabled={pending || !date} onClick={() => choose(date)}>Move earlier</Button>
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">Need a later day? Message the shop.</p>
        </>
      ) : (
        <>
          <p className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300"><CalendarDays className="size-4" />Your pre-order is ready. Choose your pick-up day</p>
          <p className="mt-1 text-xs text-muted-foreground">Today or any day up to {lastDay ? pretty(lastDay) : "the shop's deadline"}.</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Button size="sm" disabled={pending} onClick={() => choose(today)} className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700">
              {pending ? <Loader2 className="size-3 animate-spin" /> : <CalendarCheck className="size-3" />}Pick up today
            </Button>
            <span className="text-xs text-muted-foreground">or</span>
            <Input type="date" min={today} max={lastDay ?? undefined} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Pick-up day" className="h-8 w-40 text-xs" />
            <Button size="sm" variant="outline" disabled={pending || !date} onClick={() => choose(date)}>Set day</Button>
          </div>
        </>
      )}
      {balanceNote}
      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  )
}
