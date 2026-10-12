"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Landmark, Loader2, Send, Smartphone, Upload } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Remit the royalty of all paid, not-yet-remitted sales: pay BAO, upload the receipt, send.
 * The amount is computed by the database (submit_royalty_remittance), never taken from here.
 */
export function RemitRoyaltyForm({ storeId, amount }: { storeId: string; amount: number }) {
  const router = useRouter()
  const [method, setMethod] = useState<"gcash" | "bank">("gcash")
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function submit() {
    if (!file) { setError("Upload the payment receipt."); return }
    if (!reference.trim()) { setError("Enter the reference number of the payment."); return }
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const ext = file.name.split(".").pop() || "jpg"
    const path = `royalty/${storeId}/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from("order-receipts").upload(path, file)
    if (upErr) { setError("The receipt couldn't be uploaded. Please try again."); setBusy(false); return }
    const url = supabase.storage.from("order-receipts").getPublicUrl(path).data.publicUrl
    const { error: rpcErr } = await supabase.rpc("submit_royalty_remittance", {
      p_store: storeId, p_method: method, p_receipt_url: url, p_reference: reference, p_notes: notes,
    })
    setBusy(false)
    if (rpcErr) { setError(rpcErr.message); return }
    setFile(null); setPreview(null); setReference(""); setNotes("")
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Pay BAO <strong className="text-foreground">₱{amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>,
        the royalty of your paid sales, then send the receipt for BAO to approve.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {([["gcash", "GCash", Smartphone], ["bank", "Bank transfer", Landmark]] as const).map(([value, label, Icon]) => (
          <button key={value} type="button" onClick={() => setMethod(value)} aria-pressed={method === value}
            className={cn("flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              method === value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
            <Icon className="size-4" />{label}
          </button>
        ))}
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
          <Upload className="size-4 text-gold/70" />Upload payment receipt
        </button>
      )}
      <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference number" className="h-9 text-sm" />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes for BAO (optional)"
        className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm" />
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <Button className="w-full gap-2" onClick={submit} disabled={busy || !file}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Send remittance to BAO
      </Button>
    </div>
  )
}
