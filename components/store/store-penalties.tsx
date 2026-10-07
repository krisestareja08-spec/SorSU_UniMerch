"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Banknote, Check, Loader2, Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { getOrderBuyers, type OrderBuyer } from "@/app/store-order-actions"
import { unwrap } from "@/lib/action-result"
import type { ModuleKey } from "@/lib/modules"

type Penalty = {
  id: string; order_id: string | null; amount: number; status: "unpaid" | "pending_review"
  payment_method: string | null; receipt_url: string | null; reference_number: string | null; created_at: string
}

/**
 * Unclaimed pre-order penalties owed to this shop (scripts/29). While one is open the buyer can't
 * order from the shop. Cash is paid at the counter; online payments arrive with a receipt to check.
 */
export function StorePenalties({ storeId, module }: { storeId: string; module: ModuleKey }) {
  const [penalties, setPenalties] = useState<Penalty[] | null>(null)
  const [buyers, setBuyers] = useState<Record<string, OrderBuyer>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  async function load() {
    const supabase = createClient()
    const { data, error } = await supabase.from("buyer_penalties")
      .select("id, order_id, amount, status, payment_method, receipt_url, reference_number, created_at")
      .eq("store_id", storeId).in("status", ["unpaid", "pending_review"]).order("created_at", { ascending: false })
    if (error) { setPenalties([]); return } // table arrives with scripts/29
    const rows = (data ?? []).map((p) => ({ ...p, amount: Number(p.amount) })) as Penalty[]
    setPenalties(rows)
    const orderIds = rows.map((p) => p.order_id).filter((id): id is string => !!id)
    if (orderIds.length) setBuyers(await getOrderBuyers(module, orderIds).then(unwrap).catch(() => ({})))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per store
  useEffect(() => { load() }, [storeId])

  async function update(id: string, patch: Record<string, unknown>) {
    setBusy(id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from("buyer_penalties").update({ ...patch, cleared_by: user?.id ?? null }).eq("id", id)
    setBusy(null)
    if (error) alert(error.message)
    else load()
  }
  const paidNow = (method: string) => ({ status: "paid", payment_method: method, paid_at: new Date().toISOString() })

  if (!penalties || penalties.length === 0) return null
  return (
    <div className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <AlertTriangle className="size-4" />{penalties.length} unpaid penalt{penalties.length === 1 ? "y" : "ies"} for unclaimed pre-orders
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">These buyers can&apos;t order from your shop until their penalty is paid.</p>
      <ul className="mt-3 space-y-2">
        {penalties.map((p) => {
          const buyer = p.order_id ? buyers[p.order_id] : undefined
          return (
            <li key={p.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{buyer?.name || "Buyer"} <span className="text-xs text-muted-foreground">{buyer?.contact}</span></p>
                  <p className="text-xs text-muted-foreground">
                    Order #{p.order_id?.slice(0, 8) ?? "—"} · {new Date(p.created_at).toLocaleDateString()}
                    {p.status === "pending_review" && <> · <span className="font-semibold text-amber-700 dark:text-amber-300">Paid online — check receipt</span></>}
                  </p>
                </div>
                <p className="font-serif text-lg font-bold text-destructive">₱{p.amount.toLocaleString()}</p>
              </div>
              {p.status === "pending_review" && p.receipt_url && (
                <div className="mt-2">
                  <button type="button" onClick={() => setOpen(open === p.id ? null : p.id)} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                    <Receipt className="size-3.5" />{open === p.id ? "Hide" : "View"} receipt{p.reference_number ? ` · Ref ${p.reference_number}` : ""}
                  </button>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {open === p.id && <img src={p.receipt_url} alt="Penalty payment receipt" className="mt-2 max-h-64 rounded-lg border border-border object-contain" />}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {p.status === "unpaid" ? (
                  <Button size="sm" disabled={busy === p.id} onClick={() => update(p.id, paidNow("cash"))} className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700">
                    {busy === p.id ? <Loader2 className="size-3 animate-spin" /> : <Banknote className="size-3" />}Paid in Cash
                  </Button>
                ) : (
                  <>
                    <Button size="sm" disabled={busy === p.id} onClick={() => update(p.id, paidNow(p.payment_method ?? "gcash"))} className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700">
                      {busy === p.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}Confirm Payment
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy === p.id}
                      onClick={() => update(p.id, { status: "unpaid", receipt_url: null, reference_number: null, payment_method: null })}>
                      Reject Receipt
                    </Button>
                  </>
                )}
                <Button size="sm" variant="ghost" disabled={busy === p.id} className="ml-auto text-xs"
                  onClick={() => { if (window.confirm("Waive this penalty? The buyer can order again.")) update(p.id, { status: "waived", paid_at: new Date().toISOString() }) }}>
                  Waive
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
