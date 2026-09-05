"use client"

import { useState } from "react"
import { Search, Plus, Minus, Trash2, CreditCard, Wallet, QrCode, CheckCircle2, Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Item = { id: string; name: string; variant: string; price: number; stock: number }
type CartItem = Item & { qty: number }

// Items shown here are ONLY from this seller's shop
const SHOP_ITEMS: Item[] = [
  { id: "1", name: "CICT Dept Shirt",   variant: "L / Maroon",   price: 380, stock: 3 },
  { id: "2", name: "CICT Dept Shirt",   variant: "M / Maroon",   price: 380, stock: 8 },
  { id: "3", name: "SSU Tumbler",       variant: "Maroon-Gold",  price: 290, stock: 12 },
  { id: "4", name: "CICT ID Lace",      variant: "Standard",     price: 65,  stock: 24 },
  { id: "5", name: "Nursing Lace",      variant: "White",        price: 65,  stock: 18 },
  { id: "6", name: "SSU Hoodie",        variant: "M / Maroon",   price: 680, stock: 2 },
  { id: "7", name: "Foundation Ticket", variant: "General",      price: 120, stock: 45 },
  { id: "8", name: "HRM Apron Set",     variant: "M",            price: 420, stock: 5 },
]

const METHOD_ICONS = { cash: Wallet, gcash: QrCode }

export default function WalkInPaymentPage() {
  const [query, setQuery] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [method, setMethod] = useState<"cash" | "gcash">("cash")
  const [amountPaid, setAmountPaid] = useState("")
  const [refNo, setRefNo] = useState("")
  const [step, setStep] = useState<"select" | "payment" | "done">("select")

  const filtered = SHOP_ITEMS.filter((i) =>
    i.name.toLowerCase().includes(query.toLowerCase()) ||
    i.variant.toLowerCase().includes(query.toLowerCase())
  )

  function addToCart(item: Item) {
    setCart((prev) => {
      const ex = prev.find((c) => c.id === item.id)
      if (ex) return prev.map((c) => c.id === item.id ? { ...c, qty: Math.min(c.qty + 1, item.stock) } : c)
      return [...prev, { ...item, qty: 1 }]
    })
  }
  function changeQty(id: string, delta: number) {
    setCart((prev) => prev
      .map((c) => c.id === id ? { ...c, qty: c.qty + delta } : c)
      .filter((c) => c.qty > 0)
    )
  }

  const total = cart.reduce((s, c) => s + c.price * c.qty, 0)
  const change = Number(amountPaid) - total

  function handleConfirm() {
    if (method === "cash" && !amountPaid) return
    if (method === "gcash" && !refNo) return
    setStep("done")
  }

  if (step === "done") return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center p-8">
      <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
        <CheckCircle2 className="size-9 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h2 className="font-serif text-2xl font-bold text-foreground">Payment Confirmed!</h2>
      <div className="rounded-2xl border border-border bg-card p-5 text-left w-full max-w-sm space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Items</span><span className="font-medium">{cart.reduce((s,c)=>s+c.qty,0)} pcs</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold text-gold text-base">₱{total.toLocaleString()}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span className="capitalize font-medium">{method}</span></div>
        {method==="cash" && <div className="flex justify-between"><span className="text-muted-foreground">Change</span><span className="font-medium text-emerald-600">₱{Math.max(0,change).toLocaleString()}</span></div>}
        {method==="gcash" && <div className="flex justify-between"><span className="text-muted-foreground">Ref #</span><span className="font-medium">{refNo}</span></div>}
      </div>
      <Button onClick={() => { setCart([]); setAmountPaid(""); setRefNo(""); setStep("select") }}
        className="bg-primary text-primary-foreground">
        New Transaction
      </Button>
    </div>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-xl font-semibold">Walk-in Payment</h1>
        <span className="text-xs text-muted-foreground rounded-full border border-border px-2 py-1">
          POS Mode
        </span>
      </div>
      <div className="h-px bg-gradient-to-r from-gold/60 via-gold/20 to-transparent" />

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Item selector */}
        <div className="lg:col-span-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items from your shop…"
              className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-4 text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {filtered.map((item) => (
              <button key={item.id} onClick={() => addToCart(item)}
                className="flex items-center justify-between rounded-xl border border-primary/10 bg-card p-3 text-left transition-all hover:border-primary/30 hover:shadow-sm active:scale-[0.98]">
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.variant}</p>
                  <p className="text-xs text-muted-foreground">Stock: {item.stock}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gold">₱{item.price}</p>
                  <Plus className="ml-auto mt-1 size-4 text-primary" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Cart + payment */}
        <div className="lg:col-span-2 space-y-3">
          <div className="rounded-2xl border border-primary/10 bg-card p-4 shadow-sm">
            <h2 className="font-serif text-sm font-semibold mb-3 flex items-center gap-2">
              <Receipt className="size-4 text-primary" /> Cart
            </h2>
            {cart.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Add items from the left</p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {cart.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">{c.variant}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => changeQty(c.id, -1)} className="flex size-6 items-center justify-center rounded-full border border-border hover:bg-muted"><Minus className="size-3" /></button>
                      <span className="w-5 text-center text-xs font-bold">{c.qty}</span>
                      <button onClick={() => changeQty(c.id, +1)} className="flex size-6 items-center justify-center rounded-full bg-gold text-primary"><Plus className="size-3" /></button>
                    </div>
                    <span className="text-xs font-bold text-gold w-14 text-right">₱{(c.price*c.qty).toLocaleString()}</span>
                    <button onClick={() => setCart((p) => p.filter((x) => x.id !== c.id))}><Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 border-t border-dashed border-border pt-3 flex justify-between font-bold">
              <span>Total</span><span className="text-lg text-gold">₱{total.toLocaleString()}</span>
            </div>
          </div>

          {/* Payment method */}
          <div className="rounded-2xl border border-primary/10 bg-card p-4 shadow-sm space-y-3">
            <h2 className="font-serif text-sm font-semibold">Payment Method</h2>
            <div className="flex gap-2">
              {(["cash","gcash"] as const).map((m) => {
                const Icon = METHOD_ICONS[m]
                return (
                  <button key={m} onClick={() => setMethod(m)}
                    className={cn("flex-1 flex flex-col items-center gap-1 rounded-xl border py-3 text-xs font-semibold capitalize transition-all",
                      method===m ? "border-primary bg-primary/8 text-primary" : "border-border text-muted-foreground hover:border-primary/30")}>
                    <Icon className="size-5" />{m}
                  </button>
                )
              })}
            </div>

            {method === "cash" && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Amount Paid</label>
                <input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="0.00"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20" />
                {amountPaid && Number(amountPaid) >= total && (
                  <p className="text-xs font-medium text-emerald-600">Change: ₱{(Number(amountPaid)-total).toLocaleString()}</p>
                )}
              </div>
            )}
            {method === "gcash" && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">GCash Reference #</label>
                <input value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="e.g. 1234567890"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            )}

            <Button onClick={handleConfirm} disabled={cart.length===0 || (method==="cash"&&!amountPaid) || (method==="gcash"&&!refNo)}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              Confirm Payment · ₱{total.toLocaleString()}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
