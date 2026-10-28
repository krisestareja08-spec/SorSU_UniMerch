import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, getProfileRow } from "@/lib/auth"
import { canShopAsMember } from "@/lib/member-shopping"
import { MarketplaceChrome } from "@/components/marketplace/marketplace-chrome"
import { ManagementShell } from "@/components/management/management-shell"
import { getMyMemberships, requireDashboard } from "@/lib/dashboards"
import { MODULES, primaryDashboard } from "@/lib/modules"
import { SellerHeader } from "@/components/storefront/seller-header"
import { SellerInfo } from "@/components/storefront/seller-info"
import { ProductGrid } from "@/components/storefront/product-grid"
import {
  getStorefrontOnce, getStorefrontCategories, getStorefrontProducts, manageStorefrontHref, storefrontHref,
} from "@/lib/storefront"
import { BackLink } from "@/components/navigation/history-nav"

type Props = {
  params: Promise<{ sellerId: string }>
  searchParams: Promise<{ category?: string; page?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sellerId } = await params
  const storefront = await getStorefrontOnce(sellerId)
  if (!storefront) return { title: "Seller not found · UniMerch" }
  return {
    title: `${storefront.name} · UniMerch`,
    description: storefront.description ?? `Shop ${storefront.name} on UniMerch, the SorSU campus marketplace.`,
  }
}

/**
 * Seller Storefront — one page structure for every seller, loaded from the sellerId in the URL.
 * Public: anyone can browse any seller's storefront. Only the seller's own approved products are shown.
 * (Static dashboard routes like /seller/products take precedence over this dynamic segment.)
 */
export default async function SellerStorefrontPage({ params, searchParams }: Props) {
  const { sellerId } = await params
  const { category: rawCategory, page: rawPage } = await searchParams
  const supabase = await createClient()

  const storefront = await getStorefrontOnce(sellerId)
  if (!storefront) notFound()

  const category = rawCategory?.trim() || null
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1)
  const user = await getCurrentUser()

  const [{ products, total }, categories, manageHref, follow, followers] = await Promise.all([
    getStorefrontProducts(supabase, storefront, { category, page }),
    getStorefrontCategories(supabase, storefront.id),
    manageStorefrontHref(supabase, storefront.id, user?.id ?? null),
    user
      ? supabase.from("seller_follows").select("id").eq("follower_id", user.id).eq("seller_id", storefront.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("seller_follows").select("id", { count: "exact", head: true }).eq("seller_id", storefront.id),
  ])
  const productCount = categories.reduce((sum, c) => sum + c.count, 0)

  // Dashboard accounts that don't shop preview storefronts inside their own dashboard, without buyer
  // actions. Verified students / faculty / staff on store dashboards shop here like any buyer.
  const memberships = user ? await getMyMemberships(user.id) : []
  const primary = primaryDashboard(memberships)
  const shops = !primary || canShopAsMember(user ? await getProfileRow(user.id) : null, memberships.map((m) => m.module))
  const sellerCtx = primary && !shops ? await requireDashboard(primary.module) : null

  const base = storefrontHref(storefront.id)
  const pageHref = (p: number) => {
    const qs = new URLSearchParams()
    if (category) qs.set("category", category)
    if (p > 1) qs.set("page", String(p))
    const q = qs.toString()
    return q ? `${base}?${q}` : base
  }

  const content = (
      <div className={sellerCtx ? "" : "mx-auto max-w-7xl px-4 py-6 sm:px-6"}>
        <BackLink href={sellerCtx ? MODULES[sellerCtx.module].basePath : "/marketplace"} className="mb-4" />

        <SellerHeader storefront={storefront} productCount={productCount} isFollowing={!!follow.data} manageHref={manageHref} sellerMode={!!sellerCtx} />

        <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_1fr]">
          <SellerInfo storefront={storefront} categories={categories} activeCategory={category} followers={followers.count ?? 0} />

          <section aria-labelledby="storefront-products">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 id="storefront-products" className="font-serif text-lg font-semibold text-foreground">
                {category ?? "All products"}
              </h2>
              <span className="text-xs text-muted-foreground">{total} item{total === 1 ? "" : "s"}</span>
            </div>
            <ProductGrid
              products={products}
              total={total}
              page={page}
              layout={storefront.theme.layout}
              pageHref={pageHref}
              emptyText={category ? `No products in ${category} yet.` : "This seller has no live products yet."}
              readOnly={!!sellerCtx}
            />
          </section>
        </div>
      </div>
  )

  return sellerCtx
    ? <ManagementShell ctx={sellerCtx}>{content}</ManagementShell>
    : <MarketplaceChrome>{content}</MarketplaceChrome>
}
