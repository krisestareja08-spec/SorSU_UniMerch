import Image from "next/image"
import Link from "next/link"
import { CalendarDays, Package, Settings2, Star, Store } from "lucide-react"
import { ACCENTS, type Storefront } from "@/lib/storefront"
import { SellerFollowButton } from "@/components/storefront/seller-follow-button"
import { ContactSellerButton } from "@/components/marketplace/contact-seller-button"
import { cn } from "@/lib/utils"

export function formatJoinDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

/** Storefront banner + identity: logo, name, rating, join date and actions. */
export function SellerHeader({
  storefront,
  productCount,
  isFollowing,
  manageHref,
}: {
  storefront: Storefront
  productCount: number
  isFollowing: boolean
  manageHref: string | null
}) {
  const accent = ACCENTS[storefront.theme.accent]

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {storefront.theme.showBanner && (
        <div className={cn("relative h-32 bg-linear-to-r sm:h-44", accent.banner)}>
          {storefront.bannerUrl && (
            <Image src={storefront.bannerUrl} alt="" fill priority className="object-cover" sizes="(max-width: 1280px) 100vw, 1280px" />
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-end gap-4">
          <div className={cn(
            "relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-card bg-primary/10 shadow-md ring-2 sm:size-24",
            accent.ring,
            storefront.theme.showBanner && "-mt-14 sm:-mt-16",
          )}>
            {storefront.logoUrl
              ? <Image src={storefront.logoUrl} alt={`${storefront.name} logo`} fill className="object-cover" sizes="96px" />
              : <Store className="size-8 text-primary" />}
          </div>
          <div className="min-w-0 pb-1">
            <h1 className="font-serif text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{storefront.name}</h1>
            {storefront.theme.tagline && <p className="text-sm text-muted-foreground">{storefront.theme.tagline}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Star className="size-3.5 fill-gold text-gold" />
                {storefront.rating > 0 ? `${storefront.rating.toFixed(1)} (${storefront.ratingCount} rating${storefront.ratingCount === 1 ? "" : "s"})` : "No ratings yet"}
              </span>
              <span className="flex items-center gap-1"><CalendarDays className="size-3.5" /> Joined {formatJoinDate(storefront.joinedAt)}</span>
              <span className="flex items-center gap-1"><Package className="size-3.5" /> {productCount} product{productCount === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {manageHref ? (
            <Link href={manageHref} className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-1.5 text-sm font-semibold hover:bg-muted">
              <Settings2 className="size-4" /> Customize storefront
            </Link>
          ) : (
            <SellerFollowButton sellerId={storefront.id} initiallyFollowing={isFollowing} />
          )}
          <ContactSellerButton gcashNumber={storefront.gcashNumber} />
        </div>
      </div>
    </section>
  )
}
