import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, Receipt } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getBuyerOrders } from "@/lib/orders"
import { OrderHeader, OrderProductCard, OrderTimeline, PickupLocationCard } from "@/components/orders/order-parts"
import { peso } from "@/lib/order-status"

const PAYMENT_LABELS: Record<string, string> = { gcash: "GCash", cash: "Cash (walk-in)", bank: "Bank transfer" }

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [order] = await getBuyerOrders(supabase, { ids: [id], limit: 1 })
  if (!order) notFound()

  const originalTotal = order.items.reduce((sum, i) => sum + i.originalPrice * i.quantity, 0)
  const discount = Math.max(0, originalTotal - order.total)

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link href="/marketplace/orders" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> My Orders
      </Link>

      {/* Header: store + status */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <OrderHeader order={order} />
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.2fr]">
        {/* Status timeline */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-serif text-base font-semibold">Order status</h2>
          <OrderTimeline order={order} />
        </section>

        <div className="space-y-4">
          <PickupLocationCard location={order.pickupLocation} notes={order.pickupNotes} />

          {/* Product summary */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 font-serif text-base font-semibold">Items</h2>
            <div className="space-y-4 divide-y divide-border [&>*+*]:pt-4">
              {order.items.map((item) => <OrderProductCard key={item.id} item={item} />)}
            </div>
            <dl className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal (original prices)</dt><dd>{peso(originalTotal)}</dd></div>
              {discount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="text-emerald-700 dark:text-emerald-400">−{peso(discount)}</dd></div>}
              <div className="flex justify-between text-base font-bold"><dt>Order total</dt><dd className="text-gold">{peso(order.total)}</dd></div>
            </dl>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 text-sm shadow-sm">
            <h2 className="mb-2 font-serif text-base font-semibold">Payment</h2>
            <dl className="space-y-1">
              <div className="flex justify-between"><dt className="text-muted-foreground">Method</dt><dd>{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</dd></div>
              {order.referenceNumber && <div className="flex justify-between"><dt className="text-muted-foreground">Reference no.</dt><dd>{order.referenceNumber}</dd></div>}
            </dl>
            {order.receiptUrl && (
              <a href={order.receiptUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <Receipt className="size-3.5" /> View uploaded payment receipt
              </a>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
