"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  MapPin,
  CreditCard,
  QrCode,
  Banknote,
  Building2,
  Upload,
  CheckCircle2,
  ChevronRight,
  Edit2,
  AlertCircle,
  Loader2,
  ShoppingBag,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useCart } from "@/lib/cart-context"
import { submitOrder } from "./actions"

const BADGE_STYLES: Record<string, string> = {
  "Available":    "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300",
  "Pre-Order":    "bg-gold/15 text-amber-700 border border-gold/30 dark:text-gold",
  "Interest Check": "bg-primary/10 text-primary border border-primary/20",
}

const PAYMENT_METHODS = [
  { id: "gcash", label: "GCash (QR Code)", icon: QrCode,    recommended: true },
  { id: "cash",  label: "Cash (Walk-in)",  icon: Banknote },
  { id: "bank",  label: "Bank Transfer",   icon: Building2 },
]

export default function CheckoutPage() {
  const router = useRouter()
  const { items, clearCart, total } = useCart()
  const [payment, setPayment] = useState("gcash")
  const [receipt, setReceipt] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const subtotal = total

  function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setReceipt(file)
    setReceiptPreview(URL.createObjectURL(file))
  }

  async function handlePlaceOrder() {
    if (payment === "gcash" && !receipt) return
    if (items.length === 0) return
    setSubmitting(true)
    setOrderError(null)
    try {
      let receiptUrl: string | undefined
      if (receipt) {
        // Upload receipt to Supabase Storage
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        const ext = receipt.name.split(".").pop() || "jpg"
        const path = `receipts/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from("order-receipts").upload(path, receipt)
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("order-receipts").getPublicUrl(path)
          receiptUrl = urlData.publicUrl
        }
      }
      await submitOrder({ items: items.map((i) => ({ id: i.id, sellerId: i.sellerId, name: i.name, seller: i.seller, price: i.price, image: i.image, quantity: i.quantity, variant: i.variant })), paymentMethod: payment, receiptUrl, total: subtotal })
      clearCart()
      router.push("/marketplace/order-success")
    } catch (err: unknown) {
      setOrderError(err instanceof Error ? err.message : "Failed to place order. Please try again.")
      setSubmitting(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <ShoppingBag className="mx-auto size-12 text-muted-foreground/40" />
        <p className="mt-4 text-sm text-muted-foreground">Your cart is empty.</p>
        <Button asChild className="mt-4 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/marketplace">Browse Marketplace</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">Checkout Details</h1>
        <div className="mt-2 h-px bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Left column */}
        <div className="flex-1 space-y-5">
          {/* Buyer info */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-serif text-sm font-semibold text-foreground sm:text-base">
                <MapPin className="size-4 text-primary" />
                Buyer Information
              </h2>
              <button className="flex items-center gap-1 text-xs font-medium text-gold hover:underline">
                <Edit2 className="size-3.5" />Edit
              </button>
            </div>
            <div className="mt-3 h-px bg-linear-to-r from-gold/40 to-transparent" />
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {[
                ["Full Name", "Juan Dela Cruz"],
                ["Student ID", "2021-00123"],
                ["Department", "CICT"],
                ["Contact", "09XX-XXX-XXXX"],
                ["Pickup Method", "Walk-in (SSU Campus)"],
                ["Campus", "Bulan Campus"],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className="font-medium text-foreground">{v}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Order summary */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-serif text-sm font-semibold text-foreground sm:text-base">Order Items</h2>
            <div className="mt-2 h-px bg-linear-to-r from-gold/40 to-transparent" />
            <div className="mt-4 space-y-4">
              {/* Order items — from cart context */}
            {items.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    <Image src={item.image || "/placeholder.jpg"} alt={item.name} fill className="object-cover" />
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <p className="line-clamp-1 text-sm font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.seller}</p>
                    <p className="text-xs text-muted-foreground">{item.variant} · Qty: {item.quantity}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", BADGE_STYLES[item.badge] ?? BADGE_STYLES["Available"])}>
                        {item.badge}
                      </span>
                      <span className="text-sm font-bold text-gold">₱{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Payment method */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-serif text-sm font-semibold text-foreground sm:text-base">
              <CreditCard className="size-4 text-primary" />
              Payment Method
            </h2>
            <div className="mt-2 h-px bg-linear-to-r from-gold/40 to-transparent" />
            <div className="mt-4 space-y-2.5">
              {PAYMENT_METHODS.map(({ id, label, icon: Icon, recommended }) => (
                <label
                  key={id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-all",
                    payment === id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30 hover:bg-muted/50",
                  )}
                >
                  <div className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                    payment === id ? "border-gold" : "border-muted-foreground/40",
                  )}>
                    {payment === id && <div className="size-2 rounded-full bg-gold" />}
                  </div>
                  <input type="radio" name="payment" value={id} checked={payment === id} onChange={() => setPayment(id)} className="sr-only" />
                  <Icon className={cn("size-4 shrink-0", payment === id ? "text-primary" : "text-muted-foreground")} />
                  <span className={cn("flex-1 text-sm font-medium", payment === id ? "text-foreground" : "text-muted-foreground")}>
                    {label}
                  </span>
                  {recommended && (
                    <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold">Recommended</span>
                  )}
                </label>
              ))}
            </div>
          </section>

          {/* GCash QR + receipt upload */}
          {payment === "gcash" && (
            <section className="rounded-2xl border border-primary/15 bg-card p-5 shadow-sm">
              <h2 className="font-serif text-sm font-semibold text-foreground sm:text-base">GCash Payment</h2>
              <div className="mt-2 h-px bg-linear-to-r from-gold/40 to-transparent" />

              {/* QR placeholder */}
              <div className="mt-4 flex flex-col items-center gap-3">
                <div className="flex size-44 items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-muted/40">
                  <div className="text-center">
                    <QrCode className="mx-auto size-16 text-primary/30" />
                    <p className="mt-1 text-[10px] font-medium text-muted-foreground">QR Code Placeholder</p>
                    <p className="text-[9px] text-muted-foreground">Upload in Seller Dashboard</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-foreground">Scan to Pay via GCash</p>
                <p className="text-xs text-muted-foreground">Replace this QR image in your Seller Dashboard</p>
              </div>

              {/* Instructions */}
              <ol className="mt-5 space-y-2">
                {[
                  "Open GCash on your phone",
                  'Tap "Pay QR" and scan the code above',
                  "Enter the exact total amount",
                  "Take a screenshot of the confirmation",
                  "Upload your receipt below",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>

              {/* Upload receipt */}
              <div className="mt-5">
                <input ref={fileRef} type="file" accept="image/*" onChange={handleReceiptChange} className="hidden" />
                {receiptPreview ? (
                  <div className="relative">
                    <Image
                      src={receiptPreview}
                      alt="Payment receipt"
                      width={400}
                      height={200}
                      className="w-full rounded-xl object-cover"
                    />
                    <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-emerald-500 px-2.5 py-1">
                      <CheckCircle2 className="size-3.5 text-white" />
                      <span className="text-[11px] font-semibold text-white">Receipt uploaded</span>
                    </div>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="mt-2 w-full rounded-xl border border-border py-2 text-xs text-muted-foreground hover:bg-muted"
                    >
                      Replace receipt
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gold/40 py-8 transition-colors hover:border-gold/70 hover:bg-gold/5"
                  >
                    <Upload className="size-7 text-gold/60" />
                    <span className="text-sm font-medium text-foreground">Upload payment receipt</span>
                    <span className="text-xs text-muted-foreground">JPG, PNG — tap to browse</span>
                  </button>
                )}
              </div>

              {!receipt && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/5 p-3 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  Please upload your GCash receipt before placing the order.
                </div>
              )}
            </section>
          )}
        </div>

        {/* Right — summary */}
        <div className="lg:w-72 xl:w-80">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="font-serif text-sm font-semibold text-foreground sm:text-base">Payment Summary</h2>
              <div className="mt-2 h-px bg-linear-to-r from-gold/40 to-transparent" />
              <div className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                  <span>₱{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span className="text-emerald-600 dark:text-emerald-400">Free</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Payment Method</span>
                  <span className="font-medium text-foreground capitalize">
                    {PAYMENT_METHODS.find(p => p.id === payment)?.label.split(" ")[0]}
                  </span>
                </div>
                <div className="border-t border-dashed border-border pt-3">
                  <div className="flex justify-between">
                    <span className="font-bold text-foreground">Total</span>
                    <span className="text-xl font-bold text-gold">₱{subtotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {orderError && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />{orderError}
                </div>
              )}

              <Button
                onClick={handlePlaceOrder}
                size="lg"
                className="mt-5 w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={submitting || (payment === "gcash" && !receipt)}
              >
                {submitting ? <><Loader2 className="size-4 animate-spin" /> Placing Order...</> : <>{payment === "gcash" ? "Mark as Paid & Place Order" : "Place Order"}<ChevronRight className="size-4" /></>}
              </Button>

              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                Your order will be reviewed by the seller.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="fixed bottom-16 inset-x-0 z-30 border-t border-border bg-primary px-4 py-3 shadow-lg lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <p className="text-xs text-primary-foreground/70">Total</p>
            <p className="text-lg font-bold text-gold">₱{subtotal.toLocaleString()}</p>
          </div>
          <Button
            onClick={handlePlaceOrder}
            disabled={submitting || (payment === "gcash" && !receipt)}
            className="rounded-full bg-gold px-6 font-semibold text-primary hover:bg-gold/80"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : payment === "gcash" ? "Pay & Order" : "Place Order"}
          </Button>
        </div>
      </div>
    </div>
  )
}
