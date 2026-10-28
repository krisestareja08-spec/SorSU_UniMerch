"use client"

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { ManagementShell } from "@/components/management/management-shell"
import type { DashboardCtx } from "@/lib/modules"
import { BuyerIdCheck } from "@/components/store/buyer-id-check"
import { getOrderBuyers, restrictedOrderIds, type OrderBuyer } from "@/app/store-order-actions"
import { ReportBuyerButton } from "@/components/store/report-buyer-button"
import { PageHeading } from "@/components/management/dashboard-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { ShoppingCart, Package, Receipt, Check, Loader2, AlertTriangle, Bell, BadgeCheck, MessageCircle, Banknote, Search, CalendarClock, RotateCcw } from "lucide-react"
import { OrderChat } from "@/components/orders/order-chat"
import { PreorderIdReview } from "@/components/store/preorder-id-review"
import { StorePenalties } from "@/components/store/store-penalties"
import { unwrap } from "@/lib/action-result"

/** One product line of an order, with the photo and price saved at checkout */
type OrderLine = { name: string; variant: string | null; quantity: number; unitPrice: number; image: string | null }

type Order = {
  id: string; status: string; total: number; payment_method: string
  created_at: string; receipt_url: string | null; reference_number: string | null
  amount_paid: number | null; buyer_id: string
  items: OrderLine[]
  /** Pre-orders (scripts/29): pick-up day the buyer chose and its deadline, I.D. photo and the
   *  shop's I.D. check, and full / half online payment */
  is_preorder?: boolean; pickup_date?: string | null; pickup_deadline?: string | null
  id_status?: string | null; buyer_id_path?: string | null; payment_plan?: string | null
}

const STATUS_COLORS: Record<string, string> = {
  pending:          "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  paid:             "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  partially_paid:   "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  ready_for_pickup: "bg-primary/10 text-primary",
  completed:        "bg-muted text-muted-foreground",
  cancelled:        "bg-destructive/10 text-destructive",
  refunded:         "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
}
const STATUS_LABELS: Record<string, string> = {
  pending: "Pending", paid: "Payment Received", partially_paid: "Partially Paid",
  ready_for_pickup: "For Pick Up", completed: "Completed", cancelled: "Cancelled", refunded: "Returned / Refunded",
}

const PAYMENT_LABELS: Record<string, string> = { cash: "Walk-in (cash)", gcash: "GCash", bank: "Bank transfer" }

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

const balanceOf = (o: Order) => Math.max(0, o.total - (o.amount_paid ?? 0))
/** A pre-order counts as paid (served first) once any payment is recorded */
const preorderPaid = (o: Order) => (o.amount_paid ?? 0) > 0 || o.status === "paid" || o.status === "partially_paid"
const pickupMissed = (o: Order) => o.status === "ready_for_pickup" && !!o.pickup_deadline && new Date(o.pickup_deadline) < new Date()
const shortDay = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
const deadlineDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" })

const orderDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })

/** Small product photo; a box icon when the item has none */
function ItemThumb({ item, className }: { item: OrderLine; className?: string }) {
  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted", className)}>
      {item.image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={item.image} alt={item.name} loading="lazy" className="size-full object-cover" />
        : <Package className="size-1/2 text-muted-foreground/50" />}
    </div>
  )
}

/** Overlapping photos of the first few items, for compact lists */
function ThumbStack({ items }: { items: OrderLine[] }) {
  return (
    <div className="flex shrink-0 -space-x-3">
      {items.slice(0, 3).map((item, i) => <ItemThumb key={i} item={item} className="size-10 ring-2 ring-card" />)}
      {items.length > 3 && (
        <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground ring-2 ring-card">+{items.length - 3}</span>
      )}
    </div>
  )
}

/** What the store should do next with an order, shown above its buttons */
function nextStep(o: Order, needsId: boolean): string | null {
  if (needsId) return "This order has restricted items — check the buyer's I.D. before confirming it."
  if (o.is_preorder) return preorderStep(o)
  const balance = o.total - (o.amount_paid ?? 0)
  switch (o.status) {
    case "pending": return o.payment_method === "cash" ? "Waiting for the buyer to pay at the counter." : "Check the payment receipt, then mark the order paid."
    case "partially_paid": return `Balance of ${peso(balance)} still due.`
    case "paid": return "Prepare the items, then mark the order for pick up."
    case "ready_for_pickup": return o.pickup_date && o.payment_method === "cash" && balance > 0
      ? `Collect ${peso(balance)} when the buyer picks up.` : "Hand the items over when the buyer arrives, then mark it completed."
  }
  return null
}

/** Pre-orders: I.D. → payment → ready → buyer's pick-up day → completed */
function preorderStep(o: Order): string | null {
  const balance = balanceOf(o)
  switch (o.status) {
    case "pending":
      if (o.id_status !== "approved") return "Check the buyer's I.D. first."
      return o.payment_method === "cash"
        ? "Walk-in: record the payment when the buyer pays at the counter (half or full) to put them on the waitlist."
        : `Check the receipt (${o.payment_plan === "half" ? `half: ${peso(Math.round(o.total * 50) / 100)}` : `full: ${peso(o.total)}`}), then record the payment.`
    case "partially_paid": return `On the waitlist (half paid, ${peso(balance)} due). Mark it ready when the size arrives — here or from the Pre-order Form.`
    case "paid": return "On the waitlist (paid in full). Mark it ready when the size arrives — here or from the Pre-order Form. The buyer is notified."
    case "ready_for_pickup":
      if (pickupMissed(o)) return "The buyer missed their pick-up day. Give a new day, or return / refund the payment."
      if (!o.pickup_date) return `Waiting for the buyer to choose a pick-up day${o.pickup_deadline ? ` (by ${deadlineDay(o.pickup_deadline)})` : ""}.`
      return balance > 0
        ? `Pick-up on ${shortDay(o.pickup_date)}. Collect the ${peso(balance)} balance and mark it fully paid before completing.`
        : `Pick-up on ${shortDay(o.pickup_date)}. Hand the items over, then mark it completed.`
  }
  return null
}

const SectionLabel = ({ children }: { children: ReactNode }) =>
  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>

/**
 * Walk-in counter, like a cash register: the buyer comes to the counter with their order number,
 * pays in cash, and the cashier records it — handing the items over right away, or preparing them.
 */
function CounterPayment({ order, busy, blocked, onPaid }: {
  order: Order
  busy: boolean
  blocked: boolean
  onPaid: (status: "completed" | "paid" | "partially_paid", amountPaid: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [cash, setCash] = useState("")
  const received = Number.parseFloat(cash)
  const due = order.total - (order.amount_paid ?? 0)
  const valid = Number.isFinite(received) && received > 0
  const change = valid ? received - due : 0
  const paidTotal = (order.amount_paid ?? 0) + Math.min(valid ? received : 0, due)

  if (!open) {
    return (
      <Button size="sm" disabled={busy || blocked} onClick={() => setOpen(true)} className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700">
        <Banknote className="size-3.5" />Receive Payment
      </Button>
    )
  }
  return (
    <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/5">
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-[11px] text-muted-foreground">Amount due</p>
          <p className="font-serif text-lg font-bold text-foreground">{peso(due)}</p>
        </div>
        <label className="block">
          <span className="text-[11px] text-muted-foreground">Cash received</span>
          <Input type="number" inputMode="decimal" min="0" step="0.01" autoFocus value={cash} onChange={(e) => setCash(e.target.value)}
            placeholder={String(due)} className="mt-0.5 h-8 text-sm font-semibold" />
        </label>
        <div>
          <p className="text-[11px] text-muted-foreground">{valid && change < 0 ? "Short by" : "Change"}</p>
          <p className={cn("font-serif text-lg font-bold", valid && change < 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-400")}>
            {valid ? peso(Math.abs(change)) : "—"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {valid && change >= 0 ? (
          <>
            <Button size="sm" disabled={busy} onClick={() => onPaid("completed", order.total)} className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700">
              {busy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}Paid &amp; Release Items
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onPaid("paid", order.total)} className="gap-1">
              <Package className="size-3" />Paid — Prepare Items
            </Button>
          </>
        ) : valid ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onPaid("partially_paid", paidTotal)} className="gap-1 border-blue-300 text-blue-600 hover:bg-blue-50">
            Record Partial Payment ({peso(paidTotal)} of {peso(order.total)})
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Enter the cash the buyer handed over.</p>
        )}
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setOpen(false); setCash("") }} className="ml-auto text-xs">Close</Button>
      </div>
    </div>
  )
}

/**
 * Pre-order payments: cash handed over at the counter, or an online transfer checked against the
 * receipt. Full → Payment Received (or, once ready, fully paid / released); less → Partially Paid.
 */
function RecordPayment({ order, busy, blocked, onRecord }: {
  order: Order
  busy: boolean
  blocked: boolean
  onRecord: (status: "completed" | "paid" | "partially_paid" | "ready_for_pickup", amountPaid: number) => void
}) {
  const online = order.payment_method !== "cash"
  const ready = order.status === "ready_for_pickup"
  const due = balanceOf(order)
  // An online "half now" pre-order: the receipt should show half the total
  const suggested = online && order.status === "pending" && order.payment_plan === "half" ? Math.round(order.total * 50) / 100 : due
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const received = amount === "" ? suggested : Number.parseFloat(amount)
  const valid = Number.isFinite(received) && received > 0
  const full = valid && received >= due
  const paidTotal = Math.min(order.total, (order.amount_paid ?? 0) + (valid ? received : 0))

  if (!open) {
    return (
      <Button size="sm" disabled={busy || blocked} onClick={() => setOpen(true)} className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700">
        <Banknote className="size-3.5" />{online ? "Record Payment" : "Receive Payment"}
      </Button>
    )
  }
  return (
    <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/5">
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-[11px] text-muted-foreground">Balance</p>
          <p className="font-serif text-lg font-bold text-foreground">{peso(due)}</p>
        </div>
        <label className="block">
          <span className="text-[11px] text-muted-foreground">{online ? "Amount on receipt" : "Cash received"}</span>
          <Input type="number" inputMode="decimal" min="0" step="0.01" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder={String(suggested)} className="mt-0.5 h-8 text-sm font-semibold" />
        </label>
        <div>
          <p className="text-[11px] text-muted-foreground">{full ? (online ? "Fully paid" : "Change") : "Balance after"}</p>
          <p className={cn("font-serif text-lg font-bold", full ? "text-emerald-700 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400")}>
            {!valid ? "—" : full ? (online ? "✓" : peso(received - due)) : peso(order.total - paidTotal)}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {!valid ? (
          <p className="text-xs text-muted-foreground">Enter the amount {online ? "on the receipt" : "the buyer handed over"}.</p>
        ) : full && ready ? (
          <>
            <Button size="sm" disabled={busy} onClick={() => onRecord("completed", order.total)} className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700">
              {busy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}Fully Paid &amp; Release Items
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onRecord("ready_for_pickup", order.total)} className="gap-1">
              Mark Fully Paid
            </Button>
          </>
        ) : full ? (
          <Button size="sm" disabled={busy} onClick={() => onRecord("paid", order.total)} className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700">
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}Payment Received
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onRecord(ready ? "ready_for_pickup" : "partially_paid", paidTotal)} className="gap-1 border-blue-300 text-blue-600 hover:bg-blue-50">
            Partially Paid ({peso(paidTotal)} of {peso(order.total)})
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setOpen(false); setAmount("") }} className="ml-auto text-xs">Close</Button>
      </div>
    </div>
  )
}

const DATE_FILTERS = [
  { label: "Today", days: 0 },
  { label: "This Week", days: 7 },
  { label: "This Month", days: 30 },
]

export function StoreOrders({ ctx }: { ctx: DashboardCtx }) {
  const [profile, setProfile] = useState<{ role: string; full_name: string | null; email: string } | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<"active" | "history">("active")
  const [statusFilter, setStatusFilter] = useState("all")
  const [historyDays, setHistoryDays] = useState(7)
  // Counter search: the buyer reads out their order number (or name)
  const [search, setSearch] = useState("")
  const [updating, setUpdating] = useState<string | null>(null)
  const [refNums, setRefNums] = useState<Record<string, string>>({})
  const [receiptOpen, setReceiptOpen] = useState<string | null>(null)
  // Order whose buyer chat is open; ?chat=<order id> comes from a message notification
  const [chatOpen, setChatOpen] = useState<string | null>(null)
  const chatParamHandled = useRef(false)
  const [, startTransition] = useTransition()
  // Orders with restricted items need the buyer's I.D. checked before they can be confirmed.
  const [restricted, setRestricted] = useState<Set<string>>(new Set())
  const [buyers, setBuyers] = useState<Record<string, OrderBuyer>>({})
  const [idChecked, setIdChecked] = useState<Set<string>>(new Set())
  const needsIdCheck = (id: string) => restricted.has(id) && !idChecked.has(id)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setProfile({ role: "", full_name: ctx.fullName, email: ctx.email })
    // Discard overdue pre-orders and charge their penalty before listing (no-op before scripts/29)
    await supabase.rpc("expire_overdue_preorders").then(() => {}, () => {})

    // One request returns up to 1000 lines: newest orders first, so only the oldest history is left
    // out (sorting by the random order id dropped random orders). Older databases: unsorted.
    const lines = (newestFirst: boolean) => {
      const q = supabase
        .from("order_items")
        .select("order_id, product_name, product_image_url, variant, quantity, unit_price, orders(id, buyer_id, status, total, payment_method, created_at, receipt_url, reference_number, amount_paid)")
        .eq("seller_id", ctx.storeId ?? "")
      return (newestFirst ? q.order("orders(created_at)", { ascending: false }) : q.order("order_id", { ascending: false })).limit(1000)
    }
    let { data, error: err } = await lines(true)
    if (err) ({ data, error: err } = await lines(false))

    if (err) { setError(err.message); setLoading(false); return }

    const map = new Map<string, Order>()
    for (const item of data ?? []) {
      const o = Array.isArray(item.orders) ? item.orders[0] : item.orders
      if (!o) continue
      const cur: Order = map.get(o.id) ?? { ...o, total: Number(o.total), amount_paid: o.amount_paid ? Number(o.amount_paid) : null, items: [] }
      cur.items.push({ name: item.product_name, variant: item.variant, quantity: item.quantity, unitPrice: Number(item.unit_price), image: item.product_image_url })
      map.set(o.id, cur)
    }
    // Pre-order details in a separate query so older databases still list orders
    type Pre = { id: string; pickup_date: string | null; pickup_deadline?: string | null; id_status: string | null; buyer_id_path: string | null; is_preorder?: boolean; payment_plan?: string | null }
    const preFor = (columns: string) => supabase.from("orders").select(columns).in("id", [...map.keys()]) as unknown as Promise<{ data: Pre[] | null; error: unknown }>
    let { data: pre, error: preError } = await preFor("id, pickup_date, pickup_deadline, id_status, buyer_id_path, is_preorder, payment_plan")
    if (preError) ({ data: pre } = await preFor("id, pickup_date, id_status, buyer_id_path")) // before the latest scripts/29
    for (const p of pre ?? []) {
      const o = map.get(p.id)
      if (o) Object.assign(o, { ...p, is_preorder: !!p.is_preorder || !!p.pickup_date || !!p.buyer_id_path })
    }
    // Newest first (order ids are random, so they can't be used for ordering)
    setOrders([...map.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)))
    const chatParam = new URLSearchParams(window.location.search).get("chat")
    const chatOrder = chatParam && !chatParamHandled.current ? map.get(chatParam) : undefined
    if (chatOrder) {
      chatParamHandled.current = true
      setChatOpen(chatOrder.id)
      if (["completed", "cancelled", "refunded"].includes(chatOrder.status)) { setTab("history"); setHistoryDays(3650) }
      setTimeout(() => document.getElementById(`order-${chatOrder.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 100)
    }
    const ids = [...map.keys()]
    const [restrictedIds, buyerInfo] = await Promise.all([
      restrictedOrderIds(ctx.module, ids).then(unwrap).catch(() => [] as string[]),
      getOrderBuyers(ctx.module, ids).then(unwrap).catch(() => ({} as Record<string, OrderBuyer>)),
    ])
    setRestricted(new Set(restrictedIds))
    setBuyers(buyerInfo)
    setLoading(false)
  }

  useEffect(() => {
    startTransition(() => {
      load()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, [])

  async function updateOrder(orderId: string, update: Record<string, unknown>) {
    setUpdating(orderId)
    const { error: err } = await createClient().from("orders").update(update).eq("id", orderId)
    if (err) alert(err.message)
    else await load()
    setUpdating(null)
  }

  function setStatus(orderId: string, status: string, refNum?: string, amountPaid?: number) {
    const update: Record<string, unknown> = { status }
    if (refNum !== undefined) update.reference_number = refNum || null
    if (amountPaid !== undefined) update.amount_paid = amountPaid
    return updateOrder(orderId, update)
  }

  function refund(o: Order) {
    if (!window.confirm(`Mark order #${o.id.slice(0, 8)} as returned / refunded? Give the buyer back ${peso(o.amount_paid ?? 0)}. The items go back to stock.`)) return
    return setStatus(o.id, "refunded")
  }

  if (!profile) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>

  const activeStatuses = ["pending", "paid", "partially_paid", "ready_for_pickup"]
  const historyStatuses = ["completed", "cancelled", "refunded"]
  const now = new Date()

  // Pre-order queue: only paid pre-orders (half or full) are in it, in the order they were placed
  const queue = new Map(
    orders.filter((o) => o.is_preorder && ["paid", "partially_paid", "ready_for_pickup"].includes(o.status))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((o, i) => [o.id, i + 1]),
  )

  const query = search.trim().toLowerCase().replace(/^#/, "")
  const filteredOrders = orders.filter((o) => {
    if (query && !o.id.toLowerCase().startsWith(query) && !(buyers[o.id]?.name ?? "").toLowerCase().includes(query)
      && !o.items.some((l) => l.name.toLowerCase().includes(query))) return false
    if (tab === "active") {
      if (!activeStatuses.includes(o.status)) return false
      if (statusFilter === "preorders") return !!o.is_preorder
      if (statusFilter !== "all" && o.status !== statusFilter) return false
      return true
    } else {
      if (!historyStatuses.includes(o.status)) return false
      const diff = (now.getTime() - new Date(o.created_at).getTime()) / 86400000
      return historyDays === 0 ? diff < 1 : diff <= historyDays
    }
  })

  if (tab === "active" && statusFilter === "preorders") filteredOrders.sort((a, b) => (queue.get(a.id) ?? 0) - (queue.get(b.id) ?? 0))

  const readyOrders = orders.filter((o) => o.status === "ready_for_pickup")

  function countActive(s: string) { return orders.filter((o) => o.status === s).length }

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Orders" description="Manage incoming orders from your shop." />

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          <AlertTriangle className="size-4 shrink-0" />{error} — Run scripts/1_tables.sql &amp; scripts/3_columns.sql in Supabase.
        </div>
      )}

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Pending",          value: countActive("pending"),          color: "text-amber-600" },
          { label: "Paid",             value: countActive("paid") + countActive("partially_paid"), color: "text-emerald-600" },
          { label: "For Pick Up", value: countActive("ready_for_pickup"), color: "text-primary" },
          { label: "Completed",        value: orders.filter((o) => o.status === "completed").length, color: "text-foreground" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn("mt-1 font-serif text-2xl font-bold", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* For Pick Up section */}
      {readyOrders.length > 0 && (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="size-4 text-emerald-600" />
            <p className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm">{readyOrders.length} order{readyOrders.length > 1 ? "s" : ""} ready for pickup</p>
          </div>
          <div className="space-y-2">
            {readyOrders.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-card border border-border px-4 py-3">
                <ThumbStack items={o.items} />
                <div className="min-w-[9rem] flex-1">
                  <p className="text-sm font-medium">
                    <span className="font-mono">#{o.id.slice(0, 8)}</span>
                    {buyers[o.id]?.name && <span className="text-muted-foreground"> · {buyers[o.id].name}</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {o.items.map((l) => `${l.name}${l.variant ? ` (${l.variant})` : ""} ×${l.quantity}`).join(", ")}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-sm font-bold text-gold">₱{o.total.toLocaleString()}</span>
                  {o.is_preorder && balanceOf(o) > 0 ? (
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">{peso(balanceOf(o))} due</span>
                  ) : (
                    <Button size="sm" disabled={updating === o.id || needsIdCheck(o.id)} onClick={() => setStatus(o.id, "completed")}
                      className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700">
                      {updating === o.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                      Complete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ctx.storeId && <StorePenalties storeId={ctx.storeId} module={ctx.module} />}

      {/* Tabs */}
      <div className="mt-6 flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {(["active", "history"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors", tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t === "active" ? "Active Orders" : "Transaction History"}
          </button>
        ))}
      </div>

      {/* Counter search */}
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find an order — order #, buyer or item"
          aria-label="Find an order by number, buyer name or item" className="h-9 pl-9" />
      </div>

      {/* Active filter pills */}
      {tab === "active" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {[["all", "All"], ["preorders", `Pre-orders${queue.size ? ` (${queue.size})` : ""}`], ["pending", "Pending"], ["paid", "Payment Received"], ["partially_paid", "Partially Paid"], ["ready_for_pickup", "For Pick Up"]].map(([s, l]) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", statusFilter === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
              {l}
            </button>
          ))}
        </div>
      )}

      {/* History date filter */}
      {tab === "history" && (
        <div className="mt-3 flex gap-2">
          {DATE_FILTERS.map(({ label, days }) => (
            <button key={days} onClick={() => setHistoryDays(days)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", historyDays === days ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Order list */}
      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}</div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <ShoppingCart className="mx-auto size-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">No orders to show.</p>
          </div>
        ) : (
          filteredOrders.map((o) => {
            const buyer = buyers[o.id]
            const itemCount = o.items.reduce((n, l) => n + l.quantity, 0)
            const balance = balanceOf(o)
            const partlyPaid = (o.amount_paid ?? 0) > 0 && balance > 0
            const editRef = tab === "active" && o.payment_method !== "cash"
              && (["pending", "paid", "partially_paid"].includes(o.status) || (!!o.is_preorder && o.status === "ready_for_pickup"))
            const hint = tab === "active" ? nextStep(o, needsIdCheck(o.id)) : null
            return (
            <div key={o.id} id={`order-${o.id}`} className="overflow-hidden rounded-2xl border border-primary/10 bg-card shadow-sm">
              {/* 1 · Which order: number, status, when, total */}
              <div className="flex items-start justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-semibold text-foreground">#{o.id.slice(0, 8)}</p>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", STATUS_COLORS[o.status] ?? STATUS_COLORS.pending)}>
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                    {o.is_preorder && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Pre-order</span>
                    )}
                    {queue.has(o.id) && (
                      <span title={preorderPaid(o) ? "Paid: served first" : "Unpaid: served after paid pre-orders"}
                        className="rounded-full border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">Queue #{queue.get(o.id)}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{orderDate(o.created_at)} · {itemCount} item{itemCount === 1 ? "" : "s"}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-serif text-lg font-bold leading-tight text-gold">{peso(o.total)}</p>
                  {partlyPaid && !["cancelled", "refunded"].includes(o.status) && (
                    <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400">{peso(balance)} left</p>
                  )}
                </div>
              </div>

              {/* 2 · What was ordered */}
              <ul className="divide-y divide-border px-4">
                {o.items.map((l, i) => (
                  <li key={i} className="flex items-center gap-3 py-2.5">
                    <ItemThumb item={l} className="size-12" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{l.name}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {l.variant && <span className="rounded bg-muted px-1.5 py-px font-medium text-foreground">{l.variant}</span>}
                        <span>{l.quantity} × {peso(l.unitPrice)}</span>
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">{peso(l.unitPrice * l.quantity)}</p>
                  </li>
                ))}
              </ul>

              {/* 3 · Who ordered it and how they pay */}
              <div className="grid gap-4 border-t border-border px-4 py-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <SectionLabel>Buyer</SectionLabel>
                  {buyer ? (
                    <>
                      <p className="flex items-center gap-1 text-sm font-medium text-foreground">
                        <span className="truncate">{buyer.name || "No name"}</span>
                        {buyer.verified && <BadgeCheck className="size-3.5 shrink-0 text-emerald-600" aria-label="Verified" />}
                        {buyer.accountStatus !== "active" && (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold capitalize text-destructive">{buyer.accountStatus}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{buyer.contact || "No contact number"}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button onClick={() => setChatOpen(chatOpen === o.id ? null : o.id)} aria-expanded={chatOpen === o.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-primary/30 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/5">
                          <MessageCircle className="size-3" />{chatOpen === o.id ? "Hide chat" : "Chat"}
                        </button>
                        <ReportBuyerButton orderId={o.id} module={ctx.module} buyerName={buyer.name} />
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Loading buyer…</p>
                  )}
                </div>

                <div className="min-w-0">
                  <SectionLabel>Payment</SectionLabel>
                  <p className="text-sm font-medium text-foreground">
                    {PAYMENT_LABELS[o.payment_method] ?? o.payment_method}
                    {o.payment_plan === "half" && <span className="font-normal text-muted-foreground"> · half now</span>}
                  </p>
                  {o.amount_paid != null && partlyPaid && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">Paid {peso(o.amount_paid)} of {peso(o.total)}</p>
                  )}
                  {!editRef && o.reference_number && <p className="text-xs text-muted-foreground">Ref # {o.reference_number}</p>}
                  {editRef && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <Input placeholder="Reference # from receipt" defaultValue={o.reference_number ?? ""} className="h-8 flex-1 text-xs"
                        aria-label="Reference number" onChange={(e) => setRefNums((r) => ({ ...r, [o.id]: e.target.value }))} />
                      <Button size="sm" variant="outline" className="h-8 text-xs" disabled={updating === o.id}
                        onClick={() => setStatus(o.id, o.status, refNums[o.id] ?? o.reference_number ?? "")}>
                        Save
                      </Button>
                    </div>
                  )}
                  {o.receipt_url && (
                    <button onClick={() => setReceiptOpen(receiptOpen === o.id ? null : o.id)}
                      className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                      <Receipt className="size-3.5" />{receiptOpen === o.id ? "Hide" : "View"} payment receipt
                    </button>
                  )}
                </div>
              </div>

              {receiptOpen === o.id && o.receipt_url && (
                <div className="px-4 pb-3">
                  <div className="max-h-64 overflow-hidden rounded-xl border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={o.receipt_url} alt="Receipt" className="max-h-64 w-full object-contain" />
                  </div>
                </div>
              )}

              {chatOpen === o.id && (
                <div className="border-t border-border px-4 py-3">
                  <OrderChat orderId={o.id} asStore otherParty={buyer?.name || "Buyer"} />
                </div>
              )}

              {/* 4 · Pick-up and I.D. checks */}
              {(o.is_preorder || restricted.has(o.id)) && (
                <div className="space-y-2 border-t border-border px-4 py-3">
                  {o.is_preorder && (
                    <p className="flex flex-wrap items-center gap-x-2 text-xs">
                      <CalendarClock className="size-3.5 text-amber-600 dark:text-amber-300" />
                      {o.status === "ready_for_pickup" ? (
                        pickupMissed(o)
                          ? <span className="font-semibold text-destructive">Missed pick-up day{o.pickup_date ? ` (${shortDay(o.pickup_date)})` : ""}</span>
                          : o.pickup_date
                            ? <span className="font-semibold text-emerald-700 dark:text-emerald-400">Buyer picks up on {shortDay(o.pickup_date)}</span>
                            : <span className="font-medium text-amber-700 dark:text-amber-300">Buyer hasn&apos;t chosen a pick-up day{o.pickup_deadline ? ` (by ${deadlineDay(o.pickup_deadline)})` : ""}</span>
                      ) : o.pickup_date ? (
                        <span className="font-medium text-amber-700 dark:text-amber-300">Pick-up day {shortDay(o.pickup_date)}</span>
                      ) : (
                        <span className="text-muted-foreground">The buyer chooses a pick-up day once it&apos;s ready</span>
                      )}
                      {o.id_status === "pending" && <span className="text-muted-foreground">· I.D. not checked yet</span>}
                      {o.id_status === "approved" && <span className="text-emerald-700 dark:text-emerald-400">· I.D. approved</span>}
                    </p>
                  )}
                  {restricted.has(o.id) && (
                    <BuyerIdCheck
                      orderId={o.id}
                      module={ctx.module}
                      checked={idChecked.has(o.id)}
                      onChecked={() => setIdChecked((prev) => new Set(prev).add(o.id))}
                    />
                  )}
                </div>
              )}

              {/* 5 · Next step */}
              {tab === "active" && activeStatuses.includes(o.status) && (
                <div className="border-t border-border bg-muted/20 px-4 py-3">
                  {hint && (
                    <p className={cn("mb-2 text-xs", needsIdCheck(o.id) ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
                      <span className="font-semibold">Next:</span> {hint}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {o.is_preorder ? (
                      <>
                        {o.status === "pending" && o.id_status !== "approved" && (
                          <PreorderIdReview orderId={o.id} idPath={o.buyer_id_path ?? null} onDone={load} />
                        )}
                        {(o.status !== "pending" || o.id_status === "approved") && balance > 0 && (
                          <RecordPayment key={`${o.status}-${o.amount_paid}`} order={o} busy={updating === o.id} blocked={needsIdCheck(o.id)}
                            onRecord={(status, amountPaid) => setStatus(o.id, status, undefined, amountPaid)} />
                        )}
                        {/* Only paid pre-orders (half or full) are on the waitlist and can be marked ready */}
                        {(o.status === "paid" || o.status === "partially_paid") && (
                          <Button size="sm" disabled={updating === o.id || needsIdCheck(o.id)} onClick={() => setStatus(o.id, "ready_for_pickup")}
                            className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90">
                            {updating === o.id ? <Loader2 className="size-3 animate-spin" /> : <Package className="size-3" />}Mark Ready for Pick Up
                          </Button>
                        )}
                        {o.status === "ready_for_pickup" && balance <= 0 && (
                          <Button size="sm" disabled={updating === o.id || needsIdCheck(o.id)} onClick={() => setStatus(o.id, "completed")}
                            className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700">
                            {updating === o.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}Mark Completed
                          </Button>
                        )}
                        {o.status === "ready_for_pickup" && (o.pickup_date || pickupMissed(o)) && (
                          <Button size="sm" variant="outline" disabled={updating === o.id} onClick={() => updateOrder(o.id, { pickup_date: null, pickup_deadline: null })}
                            title="The buyer chooses a pick-up day again, within your claim window" className="gap-1">
                            <CalendarClock className="size-3" />Give New Pick-up Day
                          </Button>
                        )}
                        {preorderPaid(o) && (
                          <Button size="sm" variant="outline" disabled={updating === o.id} onClick={() => refund(o)}
                            className="gap-1 border-orange-300 text-orange-700 hover:bg-orange-50 dark:text-orange-300">
                            <RotateCcw className="size-3" />Return / Refund
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        {/* Walk-in: paid in cash at the counter, like a register */}
                        {o.payment_method === "cash" && (o.status === "pending" || o.status === "partially_paid") && (
                          <CounterPayment order={o} busy={updating === o.id} blocked={needsIdCheck(o.id)}
                            onPaid={(status, amountPaid) => setStatus(o.id, status, undefined, amountPaid)} />
                        )}
                        {o.status === "pending" && o.payment_method !== "cash" && (
                          <>
                            <Button size="sm" disabled={updating === o.id || needsIdCheck(o.id)} onClick={() => setStatus(o.id, "paid")}
                              className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700">
                              {updating === o.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}Payment Received
                            </Button>
                            <Button size="sm" variant="outline" disabled={updating === o.id || needsIdCheck(o.id)} onClick={() => setStatus(o.id, "partially_paid")}
                              className="gap-1 border-blue-300 text-blue-600 hover:bg-blue-50">
                              Partially Paid
                            </Button>
                          </>
                        )}
                        {(o.status === "paid" || (o.status === "partially_paid" && o.payment_method !== "cash")) && (
                          <Button size="sm" disabled={updating === o.id || needsIdCheck(o.id)} onClick={() => setStatus(o.id, "ready_for_pickup")}
                            className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90">
                            {updating === o.id ? <Loader2 className="size-3 animate-spin" /> : <Package className="size-3" />}Mark For Pick Up
                          </Button>
                        )}
                        {o.status === "ready_for_pickup" && (
                          <Button size="sm" disabled={updating === o.id || needsIdCheck(o.id)} onClick={() => setStatus(o.id, "completed")}
                            className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700">
                            {updating === o.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}Mark Completed
                          </Button>
                        )}
                      </>
                    )}
                    <Button size="sm" variant="outline" disabled={updating === o.id} onClick={() => setStatus(o.id, "cancelled")}
                      className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/5 ml-auto">
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {tab === "history" && o.is_preorder && o.status === "completed" && (
                <div className="flex justify-end border-t border-border px-4 py-2.5">
                  <Button size="sm" variant="outline" disabled={updating === o.id} onClick={() => refund(o)}
                    className="gap-1 border-orange-300 text-orange-700 hover:bg-orange-50 dark:text-orange-300">
                    <RotateCcw className="size-3" />Return / Refund
                  </Button>
                </div>
              )}
            </div>
            )
          })
        )}
      </div>
    </ManagementShell>
  )
}
