import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Image from "next/image"
import { AddToCartButton } from "@/components/marketplace/add-to-cart-button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Package } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const BADGE_STYLES: Record<string, string> = {
  "Available":      "bg-emerald-100 text-emerald-700 border border-emerald-200",
  "Pre-Order":      "bg-gold/15 text-amber-700 border border-gold/30",
  "Interest Check": "bg-primary/10 text-primary border border-primary/20",
  "Sold Out":       "bg-muted text-muted-foreground border border-border",
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: product } = await supabase
    .from("products")
    .select("id, name, description, category, price, image_url, badge, stock, seller_id")
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle()

  if (!product) notFound()

  const { data: sellerProfile } = await supabase
    .from("seller_profiles")
    .select("org_name")
    .eq("id", product.seller_id)
    .maybeSingle()

  const sellerName = sellerProfile?.org_name ?? "Campus Seller"

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <Link href="/marketplace" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to Marketplace
      </Link>

      <div className="grid gap-8 sm:grid-cols-2">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
          {product.image_url ? (
            <Image src={product.image_url} alt={product.name} fill className="object-cover" sizes="(max-width: 640px) 100vw, 50vw" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Package className="size-16 text-muted-foreground/30" />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col gap-4">
          <div>
            <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", BADGE_STYLES[product.badge] ?? BADGE_STYLES["Available"])}>
              {product.badge}
            </span>
            <h1 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground">{product.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sold by {sellerName}</p>
          </div>

          <p className="text-3xl font-bold text-gold">₱{Number(product.price).toLocaleString()}</p>

          {product.description && (
            <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Category:</span>
            <Badge variant="secondary">{product.category}</Badge>
          </div>

          {product.stock > 0 ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{product.stock} in stock</p>
          ) : product.badge !== "Pre-Order" ? (
            <p className="text-sm text-destructive">Out of stock</p>
          ) : null}

          <AddToCartButton product={{ id: product.id, name: product.name, seller: sellerName, sellerId: product.seller_id, price: Number(product.price), image: product.image_url ?? "/placeholder.jpg", badge: product.badge as "Available" | "Pre-Order" | "Interest Check" | "Sold Out", quantity: 1 }} />
        </div>
      </div>
    </div>
  )
}
