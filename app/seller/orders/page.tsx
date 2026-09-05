"use client"

import { useEffect, useState, useTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { ShoppingCart, Package, Receipt, Calendar, Check, Loader2, AlertTriangle, Bell } from "lucide-react"

type Order = {
  id: string; status: string; total: number; payment_method: string
  created_at: string; receipt_url: string | null; reference_number: string | null
  amount_paid: number | null; buyer_id: string
  items: string
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
  ready_for_pickup: "Ready for Pickup", completed: "Completed", cancelled: "Cancelled",
}

const DATE_FILTERS = [
  { label: "Today", days: 0 },
  { label: "This Week", days: 7 },
  { label: "This Month", days: 30 },
]

export default function SellerOrdersPage() {
  const [profile, setProfile] = useState<{ role: string; full_name: string | null; email: string } | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<"active" | "history">("active")
  const [statusFilter, setStatusFilter] = useState("all")
  const [historyDays, setHistoryDays] = useState(7)
  const [updating, setUpdating] = useState<string | null>(null)
  const [refNums, setRefNums] = useState<Record<string, string>>({})
  const [receiptOpen, setReceiptOpen] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle()
    setProfile({ role: p?.role ?? "seller", full_name: p?.full_name ?? null, email: user.email ?? "" })

    const { data, error: err } = await supabase
      .from("order_items")
      .select("order_id, product_name, quantity, orders(id, buyer_id, status, total, payment_method, created_at, receipt_url, reference_number, amount_paid)")
      .eq("seller_id", user.id)
      .order("order_id", { ascending: false })

    if (err) { setError(err.message); setLoading(false); return }

    const map = new Map<string, Order>()
    for (const item of data ?? []) {
      const o = Array.isArray(item.orders) ? item.orders[0] : item.orders
      if (!o) continue
      const cur: Order = map.get(o.id) ?? { ...o, total: Number(o.total), amount_paid: o.amount_paid ? Number(o.amount_paid) : null, items: "" }
      cur.items = cur.items ? `${cur.items}, ${item.product_name} ×${item.quantity}` : `${item.product_name} ×${item.quantity}`
      map.set(o.id, cur)
    }
    setOrders([...map.values()])
    setLoading(false)
  }

  useEffect(() => {
    startTransition(() => {
      load()
    })
  }, [])

  async function setStatus(orderId: string, status: string, refNum?: string) {
    setUpdating(orderId)
    const supabase = createClient()
    const update: Record<string, unknown> = { status }
    if (refNum !== undefined) update.reference_number = refNum || null
    const { error: err } = await supabase.from("orders").update(update).eq("id", orderId)
    if (err) alert(err.message)
    else await load()
    setUpdating(null)
  }

  if (!profile) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>

  const activeStatuses = ["pending", "paid", "partially_paid", "ready_for_pickup"]
  const historyStatuses = ["completed", "cancelled"]
  const now = new Date()

  const filteredOrders = orders.filter((o) => {
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
    <ManagementShell role={profile.role as "seller"} fullName={profile.full_name} email={profile.email}>
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
          { label: "Ready for Pickup", value: countActive("ready_for_pickup"), color: "text-primary" },
          { label: "Completed",        value: orders.filter((o) => o.status === "completed").length, color: "text-foreground" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn("mt-1 font-serif text-2xl font-bold", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Ready for Pickup section */}
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
                  <Button size="sm" disabled={updating === o.id} onClick={() => setStatus(o.id, "completed")}
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

      {/* Tabs */}
      <div className="mt-6 flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {(["active", "history"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors", tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t === "active" ? "Active Orders" : "Transaction History"}
          </button>
        ))}
      </div>

      {/* Active filter pills */}
      {tab === "active" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {[["all", "All"], ["pending", "Pending"], ["paid", "Paid"], ["partially_paid", "Partially Paid"], ["ready_for_pickup", "Ready"]].map(([s, l]) => (
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
            <div key={o.id} className="rounded-2xl border border-primary/10 bg-card shadow-sm overflow-hidden">
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
                  <p className="text-xs text-muted-foreground">{o.payment_method} · {new Date(o.created_at).toLocaleDateString()}</p>
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

              {/* Reference number */}
              {tab === "active" && ["pending", "paid", "partially_paid"].includes(o.status) && (
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
                  {o.status === "pending" && (
                    <>
                      <Button size="sm" disabled={updating === o.id} onClick={() => setStatus(o.id, "paid")}
                        className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700">
                        {updating === o.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}Mark Paid
                      </Button>
                      <Button size="sm" variant="outline" disabled={updating === o.id} onClick={() => setStatus(o.id, "partially_paid")}
                        className="gap-1 border-blue-300 text-blue-600 hover:bg-blue-50">
                        Partially Paid
                      </Button>
                    </>
                  )}
                  {(o.status === "paid" || o.status === "partially_paid") && (
                    <Button size="sm" disabled={updating === o.id} onClick={() => setStatus(o.id, "ready_for_pickup")}
                      className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90">
                      {updating === o.id ? <Loader2 className="size-3 animate-spin" /> : <Package className="size-3" />}Ready for Pickup
                    </Button>
                  )}
                  {o.status === "ready_for_pickup" && (
                    <Button size="sm" disabled={updating === o.id} onClick={() => setStatus(o.id, "completed")}
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
