import Link from "next/link"
import Image from "next/image"
import { Store, Star, ChevronRight, CalendarDays } from "lucide-react"
import { storefrontHref, type Storefront } from "@/lib/storefront"
import { formatJoinDate } from "@/components/storefront/seller-header"

/** Seller profile bar under a product — the store that owns the product, linking to its storefront. */
export function SellerVisitBar({ storefront }: { storefront: Storefront }) {
  const href = storefrontHref(storefront.id)
  return (
    <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <Link href={href} className="flex items-center gap-3">
        <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10">
          {storefront.logoUrl ? (
            <Image src={storefront.logoUrl} alt={storefront.name} fill className="object-cover" sizes="48px" />
          ) : (
            <Store className="size-5 text-primary" />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground hover:text-primary">{storefront.name}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="size-3 fill-gold text-gold" />
              {storefront.rating > 0 ? `${storefront.rating.toFixed(1)} (${storefront.ratingCount})` : "No ratings yet"}
            </span>
            <span className="flex items-center gap-1"><CalendarDays className="size-3" />Joined {formatJoinDate(storefront.joinedAt)}</span>
          </p>
        </div>
      </Link>
      <Link
        href={href}
        className="flex items-center justify-center gap-1 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Visit shop <ChevronRight className="size-3.5" />
      </Link>
    </div>
  )
}
