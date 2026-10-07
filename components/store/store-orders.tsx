"use client"

import { useEffect, useRef, useState, useTransition } from "react"
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
import { ShoppingCart, Package, Receipt, Check, Loader2, AlertTriangle, Bell, BadgeCheck, MessageCircle, Banknote, Search } from "lucide-react"
import { OrderChat } from "@/components/orders/order-chat"
import { PreorderIdReview } from "@/components/store/preorder-id-review"
import { StorePenalties } from "@/components/store/store-penalties"
import { unwrap } from "@/lib/action-result"

type Order = {
  id: string; status: string; total: number; payment_method: string
  created_at: string; receipt_url: string | null; reference_number: string | null
  amount_paid: number | null; buyer_id: string
  items: string
  /** Pre-orders (scripts/29): buyer's pick-up date, I.D. photo and the shop's I.D. check */
  pickup_date?: string | null; id_status?: string | null; buyer_id_path?: string | null
}

const STATUS_COLORS: Record<string, string> = {
  pending:          "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  paid:             "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  partially_paid:   "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  ready_for_pickup: "bg-primary/10 text-primary",
  completed:        "bg-muted text-muted-foreground",
  cancelled:        "bg-destructive/10 text-destructive",
}
const STATUS_LABELS: Record<string, string> = {
  pending: "Pending", paid: "Paid", partially_paid: "Partially Paid",
  ready_for_pickup: "For Pick Up", completed: "Completed", cancelled: "Cancelled",
}

const PAYMENT_LABELS: Record<string, string> = { cash: "Walk-in (cash)", gcash: "GCash", bank: "Bank transfer" }

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

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

    const { data, error: err } = await supabase
      .from("order_items")
      .select("order_id, product_name, variant, quantity, orders(id, buyer_id, status, total, payment_method, created_at, receipt_url, reference_number, amount_paid)")
      .eq("seller_id", ctx.storeId ?? "")
      .order("order_id", { ascending: false })

    if (err) { setError(err.message); setLoading(false); return }

    const map = new Map<string, Order>()
    for (const item of data ?? []) {
      const o = Array.isArray(item.orders) ? item.orders[0] : item.orders
      if (!o) continue
      const cur: Order = map.get(o.id) ?? { ...o, total: Number(o.total), amount_paid: o.amount_paid ? Number(o.amount_paid) : null, items: "" }
      // The exact size bought, e.g. "Dept Shirt (M) ×2"
      const line = `${item.product_name}${item.variant ? ` (${item.variant})` : ""} ×${item.quantity}`
      cur.items = cur.items ? `${cur.items}, ${line}` : line
      map.set(o.id, cur)
    }
    // Pre-order details in a separate query so older databases still list orders
    const { data: pre } = await supabase.from("orders").select("id, pickup_date, id_status, buyer_id_path").in("id", [...map.keys()])
    for (const p of (pre ?? []) as { id: string; pickup_date: string | null; id_status: string | null; buyer_id_path: string | null }[]) {
      const o = map.get(p.id)
      if (o) Object.assign(o, { pickup_date: p.pickup_date, id_status: p.id_status, buyer_id_path: p.buyer_id_path })
    }
    setOrders([...map.values()])
    const chatParam = new URLSearchParams(window.location.search).get("chat")
    const chatOrder = chatParam && !chatParamHandled.current ? map.get(chatParam) : undefined
    if (chatOrder) {
      chatParamHandled.current = true
      setChatOpen(chatOrder.id)
      if (chatOrder.status === "completed" || chatOrder.status === "cancelled") { setTab("history"); setHistoryDays(3650) }
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
  }, [])

  async function setStatus(orderId: string, status: string, refNum?: string, amountPaid?: number) {
    setUpdating(orderId)
    const supabase = createClient()
    const update: Record<string, unknown> = { status }
    if (refNum !== undefined) update.reference_number = refNum || null
    if (amountPaid !== undefined) update.amount_paid = amountPaid
    const { error: err } = await supabase.from("orders").update(update).eq("id", orderId)
    if (err) alert(err.message)
    else await load()
    setUpdating(null)
  }

  if (!profile) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>

  const activeStatuses = ["pending", "paid", "partially_paid", "ready_for_pickup"]
  const historyStatuses = ["completed", "cancelled"]
  const now = new Date()

  const query = search.trim().toLowerCase().replace(/^#/, "")
  const filteredOrders = orders.filter((o) => {
    if (query && !o.id.toLowerCase().startsWith(query) && !(buyers[o.id]?.name ?? "").toLowerCase().includes(query)) return false
    if (tab === "active") {
      if (!activeStatuses.includes(o.status)) return false
      if (statusFilter !== "all" && o.status !== statusFilter) return false
      return true
    } else {
      if (!historyStatuses.includes(o.status)) return false
      const diff = (now.getTime() - new Date(o.created_at).getTime()) / 86400000
      return historyDays === 0 ? diff < 1 : diff <= historyDays
    }
  })

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
              <div key={o.id} className="flex items-center justify-between gap-3 rounded-xl bg-card border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Order #{o.id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">{o.items}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gold">₱{o.total.toLocaleString()}</span>
                  <Button size="sm" disabled={updating === o.id || needsIdCheck(o.id)} onClick={() => setStatus(o.id, "completed")}
                    className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700">
                    {updating === o.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                    Complete
                  </Button>
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
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find an order — order # or buyer name"
          aria-label="Find an order by number or buyer name" className="h-9 pl-9" />
      </div>

      {/* Active filter pills */}
      {tab === "active" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {[["all", "All"], ["pending", "Pending"], ["paid", "Paid"], ["partially_paid", "Partially Paid"], ["ready_for_pickup", "For Pick Up"]].map(([s, l]) => (
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
          filteredOrders.map((o) => (
            <div key={o.id} id={`order-${o.id}`} className="rounded-2xl border border-primary/10 bg-card shadow-sm overflow-hidden">
              {/* Order header */}
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground">#{o.id.slice(0, 8)}</p>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", STATUS_COLORS[o.status] ?? STATUS_COLORS.pending)}>
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">{o.items}</p>
                  {o.pickup_date && (
                    <p className="mt-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                      Pre-order · pick up on {new Date(`${o.pickup_date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                      {o.id_status === "pending" && " · I.D. not checked yet"}
                      {o.id_status === "approved" && " · I.D. approved"}
                    </p>
                  )}
                  {buyers[o.id] && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="font-medium text-foreground">
                        Buyer: {buyers[o.id].name || "No name"}{buyers[o.id].verified && <BadgeCheck className="ml-1 inline size-3.5 text-emerald-600" aria-label="Verified" />}
                      </span>
                      <span className="text-muted-foreground">{buyers[o.id].contact || "No contact number"}</span>
                      {buyers[o.id].accountStatus !== "active" && (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-semibold capitalize text-destructive">{buyers[o.id].accountStatus}</span>
                      )}
                      <ReportBuyerButton orderId={o.id} module={ctx.module} buyerName={buyers[o.id].name} />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">{PAYMENT_LABELS[o.payment_method] ?? o.payment_method} · {new Date(o.created_at).toLocaleDateString()}</p>
                  {restricted.has(o.id) && (
                    <div className="mt-2">
                      <BuyerIdCheck
                        orderId={o.id}
                        module={ctx.module}
                        checked={idChecked.has(o.id)}
                        onChecked={() => setIdChecked((prev) => new Set(prev).add(o.id))}
                      />
                    </div>
                  )}
                  {o.amount_paid != null && o.status === "partially_paid" && (
                    <p className="text-xs text-blue-600">Paid: ₱{o.amount_paid.toLocaleString()} of ₱{o.total.toLocaleString()}</p>
                  )}
                </div>
                <p className="shrink-0 text-base font-bold text-gold">₱{o.total.toLocaleString()}</p>
              </div>

              {/* Receipt preview */}
              {o.receipt_url && (
                <div className="px-4 pb-3">
                  <button onClick={() => setReceiptOpen(receiptOpen === o.id ? null : o.id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                    <Receipt className="size-3.5" />{receiptOpen === o.id ? "Hide" : "View"} Payment Receipt
                  </button>
                  {receiptOpen === o.id && (
                    <div className="mt-2 max-h-64 overflow-hidden rounded-xl border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={o.receipt_url} alt="Receipt" className="max-h-64 w-full object-contain" />
                    </div>
                  )}
                </div>
              )}

              {/* Buyer chat */}
              <div className="border-t border-border px-4 py-2.5">
                <button onClick={() => setChatOpen(chatOpen === o.id ? null : o.id)} aria-expanded={chatOpen === o.id}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                  <MessageCircle className="size-3.5" />{chatOpen === o.id ? "Hide chat" : "Chat with Buyer"}
                </button>
                {chatOpen === o.id && <OrderChat orderId={o.id} asStore otherParty={buyers[o.id]?.name || "Buyer"} className="mt-2" />}
              </div>

              {/* Reference number */}
              {tab === "active" && o.payment_method !== "cash" && ["pending", "paid", "partially_paid"].includes(o.status) && (
                <div className="flex items-center gap-2 border-t border-border px-4 py-3">
                  <Input
                    placeholder="Reference # from receipt"
                    defaultValue={o.reference_number ?? ""}
                    className="h-8 flex-1 text-xs"
                    onChange={(e) => setRefNums((r) => ({ ...r, [o.id]: e.target.value }))}
                  />
                  <Button size="sm" variant="outline" className="h-8 text-xs"
                    disabled={updating === o.id}
                    onClick={() => setStatus(o.id, o.status, refNums[o.id] ?? o.reference_number ?? "")}>
                    Save Ref
                  </Button>
                </div>
              )}

              {/* Action buttons */}
              {tab === "active" && o.status !== "cancelled" && o.status !== "completed" && (
                <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
                  {needsIdCheck(o.id) && (
                    <p className="w-full text-xs text-amber-700 dark:text-amber-300">This order has restricted items — check the buyer&apos;s I.D. before confirming it.</p>
                  )}
                  {o.pickup_date && o.status === "pending" && (
                    <PreorderIdReview orderId={o.id} idPath={o.buyer_id_path ?? null} onDone={load} />
                  )}
                  {/* Walk-in: paid in cash at the counter, like a register (pre-orders: on pick-up) */}
                  {o.payment_method === "cash" && ((o.status === "pending" && !o.pickup_date) || o.status === "partially_paid"
                    || (o.pickup_date && o.status === "ready_for_pickup" && (o.amount_paid ?? 0) < o.total)) && (
                    <CounterPayment order={o} busy={updating === o.id} blocked={needsIdCheck(o.id)}
                      onPaid={(status, amountPaid) => setStatus(o.id, status, undefined, amountPaid)} />
                  )}
                  {o.status === "pending" && o.payment_method !== "cash" && (
                    <>
                      <Button size="sm" disabled={updating === o.id || needsIdCheck(o.id)} onClick={() => setStatus(o.id, "paid")}
                        className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700">
                        {updating === o.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}Mark Paid
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
                  {o.status === "ready_for_pickup" && !(o.pickup_date && o.payment_method === "cash" && (o.amount_paid ?? 0) < o.total) && (
                    <Button size="sm" disabled={updating === o.id || needsIdCheck(o.id)} onClick={() => setStatus(o.id, "completed")}
                      className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700">
                      {updating === o.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}Mark Completed
                    </Button>
                  )}
                  <Button size="sm" variant="outline" disabled={updating === o.id} onClick={() => setStatus(o.id, "cancelled")}
                    className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/5 ml-auto">
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </ManagementShell>
  )
}
