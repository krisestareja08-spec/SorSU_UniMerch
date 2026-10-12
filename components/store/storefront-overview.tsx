import Link from "next/link"
import { CheckCircle2, Circle, Eye, Pencil, Store } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { SellerHeader } from "@/components/storefront/seller-header"
import { SellerInfo } from "@/components/storefront/seller-info"
import { ProductGrid } from "@/components/storefront/product-grid"
import { StoreShop } from "@/components/store/store-shop"
import { getStorefront, getStorefrontCategories, getStorefrontProducts } from "@/lib/storefront"
import { MODULES, type DashboardCtx } from "@/lib/modules"
import { cn } from "@/lib/utils"

type Search = { edit?: string; category?: string; page?: string }

/**
 * The dashboard's Storefront page. It opens on the storefront exactly as buyers see it, with a
 * setup checklist; "Edit storefront" (?edit=1) opens the editor, and saving comes back here.
 */
export async function StorefrontOverview({ ctx, searchParams }: { ctx: DashboardCtx; searchParams: Search }) {
  const viewHref = `${MODULES[ctx.module].basePath}/shop`
  if (searchParams.edit) return <StoreShop ctx={ctx} viewHref={viewHref} />

  const storeId = ctx.storeId ?? ""
  const supabase = await createClient()
  const [storefront, { data: payments }] = await Promise.all([
    getStorefront(supabase, storeId),
    supabase.from("seller_profiles").select("gcash_qr_url, bank_qr_url").eq("id", storeId).maybeSingle(),
  ])
  const editHref = `${viewHref}?edit=1`

  const editButton = (
    <Link href={editHref} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <Pencil className="size-4" /> Edit storefront
    </Link>
  )

  // Store not active yet (or no store): nothing to preview, but it can still be set up
  if (!storefront) {
    return (
      <ManagementShell ctx={ctx}>
        <Toolbar editButton={editButton} />
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Store className="mx-auto size-10 text-muted-foreground/40" />
          <p className="mt-3 font-medium">Your storefront isn&apos;t live yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Buyers will see it once your store is active. You can already set it up.</p>
          <div className="mt-5 flex justify-center">{editButton}</div>
        </div>
      </ManagementShell>
    )
  }

  const category = searchParams.category?.trim() || null
  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1)
  const [{ products, total }, categories, followers] = await Promise.all([
    getStorefrontProducts(supabase, storefront, { category, page }),
    getStorefrontCategories(supabase, storefront.id),
    supabase.from("seller_follows").select("id", { count: "exact", head: true }).eq("seller_id", storefront.id),
  ])
  const productCount = categories.reduce((sum, c) => sum + c.count, 0)
  const pageHref = (p: number) => {
    const qs = new URLSearchParams()
    if (category) qs.set("category", category)
    if (p > 1) qs.set("page", String(p))
    const q = qs.toString()
    return q ? `${viewHref}?${q}` : viewHref
  }

  // What buyers need before they can shop with confidence
  const checklist = [
    { done: !!storefront.logoUrl, label: "Add a shop logo" },
    { done: !!storefront.description?.trim(), label: "Describe your shop" },
    { done: !!storefront.pickupLocation?.trim(), label: "Set a pickup location" },
    { done: !!(payments?.gcash_qr_url || payments?.bank_qr_url), label: "Upload a GCash or bank QR code" },
    { done: productCount > 0, label: "Get a product approved and live", href: `${MODULES[ctx.module].basePath}/products` },
  ]
  const remaining = checklist.filter((c) => !c.done)

  return (
    <ManagementShell ctx={ctx}>
      <Toolbar editButton={editButton} />

      {remaining.length > 0 && (
        <section aria-labelledby="setup-title" className="mt-5 rounded-2xl border border-gold/30 bg-gold/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="setup-title" className="font-serif text-base font-semibold">Finish setting up your storefront</h2>
            <span className="text-xs font-medium text-muted-foreground">{checklist.length - remaining.length} of {checklist.length} done</span>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {checklist.map((c) => (
              <li key={c.label}>
                <Link href={c.href ?? editHref}
                  className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-card",
                    c.done ? "text-muted-foreground line-through" : "font-medium text-foreground")}>
                  {c.done ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : <Circle className="size-4 shrink-0 text-gold" />}
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-5">
        <SellerHeader storefront={storefront} productCount={productCount} isFollowing={false} manageHref={null} sellerMode />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_1fr]">
        <SellerInfo storefront={storefront} categories={categories} activeCategory={category} followers={followers.count ?? 0} baseHref={viewHref} />
        <section aria-labelledby="storefront-products">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 id="storefront-products" className="font-serif text-lg font-semibold text-foreground">{category ?? "All products"}</h2>
            <span className="text-xs text-muted-foreground">{total} item{total === 1 ? "" : "s"}</span>
          </div>
          <ProductGrid
            products={products}
            total={total}
            page={page}
            layout={storefront.theme.layout}
            pageHref={pageHref}
            emptyText={category ? `No live products in ${category}.` : "No live products yet. Products appear here once BAO approves them."}
            readOnly
          />
        </section>
      </div>
    </ManagementShell>
  )
}

function Toolbar({ editButton }: { editButton: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">Storefront</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Eye className="size-4 shrink-0" /> This is your shop exactly as buyers see it.
        </p>
      </div>
      {editButton}
    </div>
  )
}
