import Image from "next/image"
import Link from "next/link"
import { CheckCircle2, Package, ShoppingBag, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function OrderSuccessPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      {/* Success card */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-lg">
        {/* Maroon banner */}
        <div className="relative flex flex-col items-center bg-gradient-to-br from-primary to-primary/80 px-8 py-10">
          {/* Decorative circles */}
          <div className="absolute right-6 top-6 size-24 rounded-full bg-primary-foreground/5" />
          <div className="absolute left-8 bottom-4 size-16 rounded-full bg-gold/10" />

          <Image
            src="/sorsu-seal.png"
            alt="SorSU seal"
            width={48}
            height={48}
            className="rounded-full ring-2 ring-gold/40"
          />
          <div className="mt-5 flex size-16 items-center justify-center rounded-full bg-emerald-500/20 ring-4 ring-emerald-500/30">
            <CheckCircle2 className="size-9 text-emerald-400" />
          </div>
          <h1 className="mt-4 font-serif text-2xl font-bold text-primary-foreground">Order Placed!</h1>
          <p className="mt-2 text-center text-sm text-primary-foreground/75">
            Your order has been submitted to the seller. You&apos;ll be notified once it&apos;s confirmed.
          </p>
        </div>

        {/* Gold divider */}
        <div className="h-1 bg-gradient-to-r from-gold via-gold/60 to-gold/10" />

        {/* Order details */}
        <div className="space-y-5 p-6">
          {/* Summary rows */}
          <div className="space-y-3 text-sm">
            {[
              ["Order ID",        "#UM-2024-00847"],
              ["Items",           "2 products (3 pcs)"],
              ["Total Amount",    "₱1,180.00"],
              ["Payment Method",  "GCash (Receipt Uploaded)"],
              ["Pickup / Delivery", "Walk-in — Bulan Campus"],
              ["Seller",          "CICT Student Council, HRM Org"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">{k}</span>
                <span className="text-right font-medium text-foreground">{v}</span>
              </div>
            ))}
            {/* Total highlighted */}
            <div className="border-t border-dashed border-border pt-3">
              <div className="flex justify-between font-bold">
                <span className="text-foreground">Total Paid</span>
                <span className="text-xl text-gold">₱1,180.00</span>
              </div>
            </div>
          </div>

          {/* Pickup note */}
          <div className="flex items-start gap-3 rounded-xl border border-gold/25 bg-gold/8 p-4 text-sm">
            <Package className="mt-0.5 size-4 shrink-0 text-gold" />
            <div>
              <p className="font-semibold text-foreground">Pickup Instructions</p>
              <p className="mt-0.5 text-muted-foreground">
                Bring your Student ID and order confirmation when claiming your items. Check your notifications for the
                pickup schedule.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/marketplace/orders">
                <Package className="size-4" />
                View Order Status
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="flex-1 gap-2">
              <Link href="/marketplace">
                <ShoppingBag className="size-4" />
                Continue Shopping
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
