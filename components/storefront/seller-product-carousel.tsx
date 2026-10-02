import Link from "next/link"
import Image from "next/image"
import { ChevronRight, Package } from "lucide-react"

type CarouselProduct = {
  id: string
  name: string
  price: number
  image_url: string | null
  stock: number
}

/** "More from this seller" rail on the product page, with a link to the full storefront. */
export function SellerProductCarousel({
  products,
  sellerHref,
  sellerName,
}: {
  products: CarouselProduct[]
  sellerHref: string
  sellerName: string
}) {
  if (products.length === 0) return null

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-base font-semibold text-foreground sm:text-lg">More from {sellerName}</h2>
        <Link href={sellerHref} className="inline-flex items-center gap-0.5 text-xs font-medium text-gold hover:underline">
          View shop <ChevronRight className="size-3" />
        </Link>
      </div>
      <div className="mb-4 mt-1.5 h-px bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />
      <div className="flex gap-3 overflow-x-auto pb-2">
        {products.map((p) => (
          <Link key={p.id} href={`/marketplace/product/${p.id}`} className="w-32 shrink-0 sm:w-36">
            <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
              {p.image_url ? (
                <Image src={p.image_url} alt={p.name} fill className="object-cover" sizes="144px" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Package className="size-8 text-muted-foreground/30" />
                </div>
              )}
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-tight text-foreground">{p.name}</p>
            <p className="text-sm font-bold text-gold">₱{p.price.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{p.stock > 0 ? `Stock: ${p.stock}` : "Out of stock"}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
