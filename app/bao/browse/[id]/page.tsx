import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ProductControl } from "@/components/bao/product-control"
import { FlagViolationForm } from "@/components/bao/flag-violation-form"
import { ArrowLeft, Package, ShieldAlert, Store } from "lucide-react"
import { peso } from "@/lib/analytics"
import { loadVariants } from "@/lib/variants"
import { AFFILIATION_LABELS, type Affiliation } from "@/lib/roles"

type ProductRow = {
  id: string; name: string; description: string | null; category: string; price: number; stock: number; badge: string; status: string
  image_url: string | null; images?: string[] | null; variations?: unknown; seller_id: string
  is_restricted: boolean | null; allowed_roles: string[] | null; is_royalty_product: boolean | null; royalty_amount: number | null; pulled_reason?: string | null
}

/** A product as BAO reviews it: details and description, with pull-out and flag-the-seller controls. No buying. */
export default async function BaoProductReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireDashboard("bao", "marketplace")
  const supabase = await createClient()

  const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle()
  const product = data as ProductRow | null
  if (!product) notFound()

  const [{ data: store }, { data: violations }] = await Promise.all([
    supabase.from("seller_profiles").select("id, org_name, category, status").eq("id", product.seller_id).maybeSingle(),
    supabase.from("store_violations").select("reason, severity, product_name, created_at").eq("store_id", product.seller_id).order("created_at", { ascending: false }).limit(5),
  ])
  const images = [product.image_url, ...(Array.isArray(product.images) ? product.images : [])].filter((x, i, a): x is string => !!x && a.indexOf(x) === i)
  const variations = Array.isArray(product.variations) ? (product.variations as string[]) : []
  // Each size with its own price, stock and SKU (scripts/28)
  const variants = (await loadVariants(supabase, [product.id]))?.get(product.id) ?? []

  return (
    <ManagementShell ctx={ctx}>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
        <Link href="/bao/browse"><ArrowLeft className="size-4" />Marketplace (view only)</Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
            {images[0] ? <Image src={images[0]} alt={product.name} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 45vw" /> : <Package className="m-auto mt-24 size-16 text-muted-foreground/30" />}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.slice(1).map((src) => (
                <div key={src} className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted"><Image src={src} alt="" fill className="object-cover" sizes="64px" /></div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{product.category} · {product.badge} · status: {product.status}</p>
            <h1 className="mt-1 font-serif text-2xl font-semibold">{product.name}</h1>
            <p className="mt-1 text-2xl font-bold text-gold">{peso(Number(product.price))}</p>
            <p className="text-sm text-muted-foreground">{product.stock} in stock</p>
          </div>

          <section>
            <h2 className="text-sm font-semibold">Description</h2>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{product.description || "No description provided."}</p>
          </section>

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-muted/40 px-3 py-2"><dt className="text-xs text-muted-foreground">Variations</dt><dd>{variants.length
              ? <ul className="mt-0.5 space-y-0.5">{variants.map((v) => <li key={v.id}>{v.name} · {peso(v.price)} · {v.stock} in stock{v.sku ? ` · SKU ${v.sku}` : ""}</li>)}</ul>
              : variations.length ? variations.join(", ") : "None"}</dd></div>
            <div className="rounded-lg bg-muted/40 px-3 py-2"><dt className="text-xs text-muted-foreground">Official logo</dt><dd>{product.is_royalty_product ? `Yes · ${peso(Number(product.royalty_amount ?? 0))} royalty per sale` : "No"}</dd></div>
            <div className="col-span-2 rounded-lg bg-muted/40 px-3 py-2"><dt className="text-xs text-muted-foreground">Restricted to</dt>
              <dd>{product.is_restricted ? (product.allowed_roles ?? []).map((r) => AFFILIATION_LABELS[r as Affiliation] ?? r).join(", ") || "—" : "Everyone"}</dd></div>
          </dl>

          <Link href={`/bao/sellers/${product.seller_id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/30">
            <Store className="size-5 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{store?.org_name ?? "Unknown store"}</span>
              <span className="block text-xs text-muted-foreground">{store?.category ?? "Store"} · {store?.status ?? "active"} · open in Seller Monitoring</span>
            </span>
          </Link>

          <Card className="border-destructive/20">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 font-serif text-base"><ShieldAlert className="size-4 text-destructive" />BAO controls</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Pull out this product</p>
                <ProductControl id={product.id} status={product.status} pulledReason={product.pulled_reason} />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Flag the seller for a violation</p>
                <FlagViolationForm storeId={product.seller_id} productId={product.id} />
              </div>
              {(violations ?? []).length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Previous violations of this store</p>
                  <ul className="space-y-1 text-xs">
                    {(violations ?? []).map((v, i) => (
                      <li key={i} className="rounded-md bg-destructive/5 px-2 py-1">
                        <span className="font-semibold capitalize">{v.severity}</span> · {v.product_name ? `${v.product_name}: ` : ""}{v.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ManagementShell>
  )
}
