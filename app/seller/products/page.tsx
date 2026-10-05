import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { AddProductModal } from "@/components/seller/add-product-modal"
import { Card } from "@/components/ui/card"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Package, Clock, CheckCircle2, XCircle, AlertTriangle, FilePenLine, Lock, Award } from "lucide-react"
import { deleteProduct, publishDraft } from "./actions"

const STATUS_STYLES = {
  draft:    { label: "Draft",              icon: FilePenLine,   color: "bg-muted text-muted-foreground" },
  pending:  { label: "Pending BAO Review",  icon: Clock,         color: "bg-amber-100/90 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  approved: { label: "Live on Marketplace", icon: CheckCircle2, color: "bg-emerald-100/90 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  rejected: { label: "Rejected",            icon: XCircle,      color: "bg-destructive/10 text-destructive" },
  pulled:   { label: "Pulled out by BAO",   icon: XCircle,      color: "bg-destructive/90 text-destructive-foreground" },
}

export default async function SellerProductsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  // Dashboard header search (?q=) filters products by name
  const term = ((await searchParams).q ?? "").trim().replace(/[%,()]/g, "")
  const ctx = await requireDashboard("seller", "products")
  const sellerId = ctx.storeId ?? ""
  const supabase = await createClient()

  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .eq("seller_id", sellerId)
    .ilike("name", `%${term}%`)
    .order("created_at", { ascending: false })

  const items = products ?? []
  const counts = {
    all: items.length,
    pending: items.filter((p) => p.status === "pending").length,
    approved: items.filter((p) => p.status === "approved").length,
    rejected: items.filter((p) => p.status === "rejected").length,
  }

  return (
    <ManagementShell ctx={ctx}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeading title="My Products" description="Submit products for BAO approval. Approved products appear on the marketplace." />
        <AddProductModal sellerId={sellerId} />
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total",    value: counts.all,      color: "text-foreground" },
          { label: "Pending",  value: counts.pending,  color: "text-amber-600 dark:text-amber-400" },
          { label: "Approved", value: counts.approved, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Rejected", value: counts.rejected, color: "text-destructive" },
        ].map((s) => (
          <Card key={s.label} className="border-primary/10 p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn("mt-1 font-serif text-2xl font-bold", s.color)}>{s.value}</p>
          </Card>
        ))}
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0" />
          Could not load products — run scripts/setup_all.sql in Supabase first.
        </div>
      )}

      <div className="mt-6">
        {!error && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 py-16 text-center">
            <Package className="size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">No products yet</p>
            <p className="text-xs text-muted-foreground/60">Click &ldquo;+ Add Product&rdquo; to submit your first listing.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((product) => {
              const s = STATUS_STYLES[product.status as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.pending
              const Icon = s.icon
              return (
                <div key={product.id} className="flex flex-col overflow-hidden rounded-xl border border-primary/10 bg-card shadow-sm">
                  <div className="relative aspect-square w-full overflow-hidden bg-muted">
                    {product.image_url ? (
                      <Image src={product.image_url} alt={product.name} fill className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="size-10 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className={cn("absolute inset-x-0 bottom-0 flex items-center gap-1 px-2 py-1 text-[10px] font-bold backdrop-blur-sm", s.color)}>
                      <Icon className="size-3 shrink-0" />
                      <span className="truncate">{s.label}</span>
                    </div>
                    {product.is_restricted && (
                      <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                        <Lock className="size-2.5" /> Restricted
                      </span>
                    )}
                    {product.is_royalty_product && (
                      <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                        <Award className="size-2.5" /> {product.royalty_percentage}% royalty
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <p className="line-clamp-2 text-xs font-medium leading-tight text-foreground">{product.name}</p>
                    <p className="text-[11px] text-muted-foreground">{product.category}</p>
                    <p className="mt-auto pt-1 text-sm font-bold text-gold">₱{Number(product.price).toLocaleString()}</p>
                    {product.is_royalty_product && (
                      <p className="text-[10px] text-muted-foreground">You receive ₱{Number(product.final_price).toLocaleString()} per sale after the BAO royalty</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">Stock: {product.stock}</p>
                    {(product.status === "rejected" || product.status === "pulled") && product.bao_comment && (
                      <p className="mt-1 rounded-md bg-destructive/10 p-1.5 text-[10px] text-destructive">
                        BAO: {product.bao_comment}
                      </p>
                    )}
                    {product.status === "draft" && (
                      <div className="mt-1.5 flex gap-1.5">
                        <form action={publishDraft.bind(null, product.id, "seller")} className="flex-1">
                          <button type="submit" className="w-full rounded-lg border border-primary/20 bg-primary/8 py-1 text-[10px] font-semibold text-primary hover:bg-primary/15 transition-colors">
                            Publish
                          </button>
                        </form>
                        <form action={deleteProduct.bind(null, product.id, "seller")} className="flex-1">
                          <button type="submit" className="w-full rounded-lg border border-destructive/20 py-1 text-[10px] font-semibold text-destructive hover:bg-destructive/10 transition-colors">
                            Delete
                          </button>
                        </form>
                      </div>
                    )}
                    {product.status === "pending" && (
                      <form action={deleteProduct.bind(null, product.id, "seller")}>
                        <button type="submit" className="mt-1.5 w-full rounded-lg border border-destructive/20 py-1 text-[10px] font-semibold text-destructive hover:bg-destructive/10 transition-colors">
                          Withdraw
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </ManagementShell>
  )
}
