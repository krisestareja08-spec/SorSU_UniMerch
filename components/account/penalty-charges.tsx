"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Banknote, CheckCircle2, Clock, Loader2, Smartphone, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Penalty = {
  id: string; order_id: string | null; amount: number; reason: string; status: "unpaid" | "pending_review" | "paid" | "waived"
  created_at: string; store_id: string
  shop: { name: string; hours: string | null; location: string | null; qrUrl: string | null }
}

const STATUS: Record<Penalty["status"], { label: string; tone: string }> = {
  unpaid:         { label: "Unpaid", tone: "bg-destructive/10 text-destructive" },
  pending_review: { label: "Waiting for the shop to confirm", tone: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  paid:           { label: "Paid", tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  waived:         { label: "Waived", tone: "bg-muted text-muted-foreground" },
}

/**
 * Penalty charges for unclaimed pre-orders (scripts/29), on the buyer's account page. While one is
 * unpaid the buyer can't order from that shop. Pay at the shop's counter (cash), or online when the
 * shop has a GCash QR — the shop confirms and the charge is cleared.
 */
export function PenaltyCharges() {
  const [penalties, setPenalties] = useState<Penalty[] | null>(null)
  const [paying, setPaying] = useState<string | null>(null)

  async function load() {
    const supabase = createClient()
    // Overdue pre-orders are discarded (and charged) first, so the list is current
    await supabase.rpc("expire_overdue_preorders").then(() => {}, () => {})
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase.from("buyer_penalties")
      .select("id, order_id, amount, reason, status, created_at, store_id")
      .eq("buyer_id", user.id).order("created_at", { ascending: false }).limit(30)
    if (error || !data?.length) { setPenalties([]); return } // table arrives with scripts/29
    const storeIds = [...new Set(data.map((p) => p.store_id))]
    type Shop = { id: string; org_name: string | null; store_hours?: string | null; pickup_location?: string | null; gcash_qr_url?: string | null; qr_status?: string | null }
    const loadShops = async (columns: string) =>
      (await supabase.from("seller_profiles").select(columns).in("id", storeIds)) as unknown as { data: Shop[] | null; error: unknown }
    let { data: shops, error: shopError } = await loadShops("id, org_name, store_hours, pickup_location, gcash_qr_url, qr_status")
    if (shopError) ({ data: shops } = await loadShops("id, org_name, gcash_qr_url, qr_status"))
    const byId = new Map((shops ?? []).map((s) => [s.id, s]))
    setPenalties(data.map((p) => {
      const s = byId.get(p.store_id)
      return {
        ...p, amount: Number(p.amount), status: p.status as Penalty["status"],
        shop: { name: s?.org_name ?? "Shop", hours: s?.store_hours ?? null, location: s?.pickup_location ?? null, qrUrl: s?.qr_status === "active" ? s?.gcash_qr_url ?? null : null },
      }
    }))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  useEffect(() => { load() }, [])

  if (!penalties || penalties.length === 0) return null
  const owed = penalties.filter((p) => p.status === "unpaid" || p.status === "pending_review")
  const total = owed.reduce((n, p) => n + p.amount, 0)

  return (
    <section id="penalties" className="scroll-mt-24 rounded-2xl border border-destructive/20 bg-card p-4 shadow-sm">
      <h2 className="flex items-center gap-2 font-serif text-base font-semibold text-foreground">
        <AlertTriangle className="size-4 text-destructive" />Penalty charges
      </h2>
      {owed.length > 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          You owe <span className="font-bold text-destructive">₱{total.toLocaleString()}</span>. You can&apos;t order from a shop until its penalty is paid.
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">All penalties are cleared.</p>
      )}
      <ul className="mt-3 space-y-3">
        {penalties.map((p) => (
          <li key={p.id} className="rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{p.shop.name}</p>
                <p className="text-xs text-muted-foreground">{p.reason} · Order #{p.order_id?.slice(0, 8) ?? "—"} · {new Date(p.created_at).toLocaleDateString()}</p>
                <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS[p.status].tone)}>{STATUS[p.status].label}</span>
              </div>
              <p className={cn("font-serif text-lg font-bold", p.status === "unpaid" ? "text-destructive" : "text-muted-foreground")}>₱{p.amount.toLocaleString()}</p>
            </div>
            {p.status === "unpaid" && (
              paying === p.id
                ? <PayOnline penalty={p} onDone={() => { setPaying(null); load() }} onCancel={() => setPaying(null)} />
                : (
                  <div className="mt-3 space-y-2">
                    <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
                      <Banknote className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>
                        <span className="font-medium text-foreground">Pay at the counter:</span> pay ₱{p.amount.toLocaleString()} in cash at {p.shop.name}
                        {p.shop.location ? ` (${p.shop.location})` : ""}{p.shop.hours ? ` — ${p.shop.hours}` : ""}. The shop clears it right away.
                      </span>
                    </p>
                    {p.shop.qrUrl && (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPaying(p.id)}>
                        <Smartphone className="size-3.5" />Pay online with GCash
                      </Button>
                    )}
                  </div>
                )
            )}
            {p.status === "pending_review" && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3.5" />Receipt sent. The shop will confirm your payment.</p>
            )}
            {p.status === "paid" && <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="size-3.5" />Cleared — you can order from this shop again.</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** GCash: scan the shop's QR, upload the receipt; the shop confirms it. */
function PayOnline({ penalty, onDone, onCancel }: { penalty: Penalty; onDone: () => void; onCancel: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [reference, setReference] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function submit() {
    if (!file) { setError("Upload your GCash receipt."); return }
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const ext = file.name.split(".").pop() || "jpg"
    const path = `penalties/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from("order-receipts").upload(path, file)
    if (upErr) { setError("The receipt couldn't be uploaded. Please try again."); setBusy(false); return }
    const url = supabase.storage.from("order-receipts").getPublicUrl(path).data.publicUrl
    const { error: rpcErr } = await supabase.rpc("submit_penalty_payment", { p_penalty: penalty.id, p_method: "gcash", p_receipt_url: url, p_reference: reference })
    setBusy(false)
    if (rpcErr) setError(rpcErr.message)
    else onDone()
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-primary/15 bg-muted/30 p-3">
      <div className="flex flex-col items-center gap-1.5">
        <div className="relative size-40 overflow-hidden rounded-xl border border-border bg-card">
          <Image src={penalty.shop.qrUrl!} alt={`${penalty.shop.name} GCash QR`} fill className="object-contain" sizes="160px" />
        </div>
        <p className="text-xs text-muted-foreground">Scan with GCash and pay exactly <span className="font-semibold text-foreground">₱{penalty.amount.toLocaleString()}</span></p>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)) } }} />
      {preview ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Receipt" className="h-20 rounded-lg border border-border object-cover" />
          <button type="button" onClick={() => fileRef.current?.click()} className="text-xs font-medium text-primary hover:underline">Replace</button>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gold/40 py-4 text-sm font-medium hover:border-gold/70">
          <Upload className="size-4 text-gold/70" />Upload GCash receipt
        </button>
      )}
      <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="GCash reference number (optional)" className="h-8 text-xs" />
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button size="sm" className="flex-1 gap-1.5" onClick={submit} disabled={busy || !file}>
          {busy && <Loader2 className="size-3.5 animate-spin" />}Send receipt
        </Button>
      </div>
    </div>
  )
}
