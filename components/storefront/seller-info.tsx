import Link from "next/link"
import { CalendarDays, MapPin, Star, Tag, Users } from "lucide-react"
import { CAMPUS_LABELS, type Campus } from "@/lib/roles"
import { ACCENTS, storefrontHref, type Storefront } from "@/lib/storefront"
import { formatJoinDate } from "@/components/storefront/seller-header"
import { cn } from "@/lib/utils"

/** About the seller: description, facts and the seller's own categories. */
export function SellerInfo({
  storefront,
  categories,
  activeCategory,
  followers,
}: {
  storefront: Storefront
  categories: { name: string; count: number }[]
  activeCategory: string | null
  followers: number
}) {
  const accent = ACCENTS[storefront.theme.accent]
  const base = storefrontHref(storefront.id)

  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-serif text-base font-semibold text-foreground">About {storefront.name}</h2>
        <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
          {storefront.description || "This seller hasn't added a description yet."}
        </p>
        <dl className="mt-4 space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2"><Star className="size-3.5 fill-gold text-gold" />
            <dd>{storefront.rating > 0 ? `${storefront.rating.toFixed(1)} out of 5 · ${storefront.ratingCount} rating${storefront.ratingCount === 1 ? "" : "s"}` : "No ratings yet"}</dd></div>
          <div className="flex items-center gap-2"><CalendarDays className="size-3.5" /><dd>Joined {formatJoinDate(storefront.joinedAt)}</dd></div>
          {storefront.campus && (
            <div className="flex items-center gap-2"><MapPin className="size-3.5" /><dd>{CAMPUS_LABELS[storefront.campus as Campus] ?? storefront.campus}</dd></div>
          )}
          {storefront.orgCategory && <div className="flex items-center gap-2"><Tag className="size-3.5" /><dd>{storefront.orgCategory}</dd></div>}
          {storefront.pickupLocation && (
            <div className="flex items-start gap-2"><MapPin className="mt-0.5 size-3.5 shrink-0 text-gold" />
              <dd><span className="font-medium text-foreground">Pickup:</span> {storefront.pickupLocation}{storefront.pickupNotes ? <span className="block">{storefront.pickupNotes}</span> : null}</dd></div>
          )}
          <div className="flex items-center gap-2"><Users className="size-3.5" /><dd>{followers} follower{followers === 1 ? "" : "s"}</dd></div>
        </dl>
      </div>

      <nav aria-label="Seller categories" className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-serif text-base font-semibold text-foreground">Categories</h2>
        {categories.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No categories yet.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:items-stretch">
            <Link href={base} scroll={false}
              className={cn("flex items-center justify-between rounded-full border px-3 py-1 text-xs font-medium lg:rounded-lg",
                !activeCategory ? accent.chip : "border-border text-muted-foreground hover:text-foreground")}>
              All products
            </Link>
            {categories.map((c) => (
              <Link key={c.name} href={`${base}?category=${encodeURIComponent(c.name)}`} scroll={false}
                className={cn("flex items-center justify-between gap-2 rounded-full border px-3 py-1 text-xs font-medium lg:rounded-lg",
                  activeCategory === c.name ? accent.chip : "border-border text-muted-foreground hover:text-foreground")}>
                <span>{c.name}</span><span className="opacity-70">{c.count}</span>
              </Link>
            ))}
          </div>
        )}
      </nav>
    </aside>
  )
}
