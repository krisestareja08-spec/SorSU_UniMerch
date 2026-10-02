import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Package } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { ProductVariantActions } from "@/components/marketplace/product-variant-actions"
import { SellerVisitBar } from "@/components/storefront/seller-visit-bar"
import { SellerProductCarousel } from "@/components/storefront/seller-product-carousel"
import { getStorefront, storefrontHref } from "@/lib/storefront"

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
    .select("id, name, description, category, price, final_price, is_royalty_product, image_url, badge, stock, seller_id, variations")
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle()

  // notFound() also covers restricted products the signed-in viewer isn't verified for — the
  // "approved products are public" RLS policy in scripts/5_seller_ecosystem.sql simply omits the row.
  if (!product) notFound()

  // The seller is the store that owns this product (products.seller_id) — never the viewer.
  const storefront = await getStorefront(supabase, product.seller_id)
  const sellerName = storefront?.name ?? "Campus Seller"
  const sellerHref = storefrontHref(product.seller_id)
  // Buyers pay the listed price; the logo royalty is deducted from the seller's earnings and goes to BAO.
  const displayPrice = Number(product.price)
  const variations: string[] = Array.isArray(product.variations) ? product.variations : []

  const { data: relatedRows } = await supabase
    .from("products")
    .select("id, name, price, final_price, is_royalty_product, image_url, stock")
    .eq("seller_id", product.seller_id)
    .eq("status", "approved")
    .neq("id", product.id)
    .limit(10)

  const relatedProducts = (relatedRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    image_url: p.image_url,
    stock: p.stock,
  }))

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
            <Link href={sellerHref} className="mt-1 inline-block text-sm text-muted-foreground hover:text-primary hover:underline">
              Sold by {sellerName}
            </Link>
          </div>

          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-gold">₱{displayPrice.toLocaleString()}</p>
            {product.is_royalty_product && (
              <p className="text-xs text-muted-foreground">Official university merch — includes a BAO royalty</p>
            )}
          </div>

          {product.description && (
            <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Seller:</span>
            <Link href={sellerHref} className="font-medium text-foreground hover:text-primary hover:underline">
              {sellerName}
            </Link>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Category:</span>
            <Badge variant="secondary">{product.category}</Badge>
          </div>

          {product.stock > 0 ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{product.stock} in stock</p>
          ) : product.badge !== "Pre-Order" ? (
            <p className="text-sm text-destructive">Out of stock</p>
          ) : null}

          <ProductVariantActions
            product={{ id: product.id, name: product.name, seller: sellerName, sellerId: product.seller_id, price: displayPrice, image: product.image_url ?? "/placeholder.jpg", badge: product.badge as "Available" | "Pre-Order" | "Interest Check" | "Sold Out" }}
            variations={variations}
          />
        </div>
      </div>

      {storefront && <SellerVisitBar storefront={storefront} />}

      <SellerProductCarousel products={relatedProducts} sellerHref={sellerHref} sellerName={sellerName} />
    </div>
  )
}
