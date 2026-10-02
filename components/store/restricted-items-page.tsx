import Link from "next/link"
import { MODULES, type DashboardCtx } from "@/lib/modules"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck } from "lucide-react"
import { AFFILIATION_LABELS, type Affiliation } from "@/lib/roles"
import { peso } from "@/lib/analytics"

/** What a buyer must show for each eligible group (matches the verification rules). */
function requirement(groups: string[]) {
  if (groups.includes("student") && groups.length === 1) return "Verified student — I.D. + COR"
  if (groups.includes("student")) return "Verified member — students: I.D. + COR; others: I.D."
  return "Verified member — I.D."
}

type Row = { id: string; name: string; category: string; price: number; stock: number; status: string; allowed_roles: string[] | null }

/** Restricted items in an office store (only verified buyers of the listed groups can buy them). */
export async function RestrictedItemsPage({ ctx }: { ctx: DashboardCtx }) {
  const base = MODULES[ctx.module].basePath
  const supabase = await createClient()
  const { data } = await supabase
    .from("products")
    .select("id, name, category, price, stock, status, allowed_roles")
    .eq("seller_id", ctx.storeId ?? "")
    .eq("is_restricted", true)
    .order("name")
  const items = (data ?? []) as Row[]

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Restricted Items" description="Items only verified buyers of specific groups can see and buy. Staff check the buyer's I.D. on the order before confirming." />
      <Card className="mt-6 border-primary/10">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 font-serif text-base"><ShieldCheck className="size-4 text-gold" />Restricted item registry</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No restricted items yet. Mark a product as restricted when you <Link href={`${base}/products`} className="font-medium text-primary hover:underline">add it</Link>.
            </p>
          ) : (
            <table className="w-full min-w-160 text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Item</th><th className="py-2 pr-3 font-medium">Eligible</th>
                <th className="py-2 pr-3 font-medium">Requirement</th><th className="py-2 pr-3 text-right font-medium">Price</th>
                <th className="py-2 pr-3 text-right font-medium">Stock</th><th className="py-2 font-medium">Status</th></tr></thead>
              <tbody>
                {items.map((p) => {
                  const groups = p.allowed_roles ?? []
                  return (
                    <tr key={p.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3"><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.category}</p></td>
                      <td className="py-2 pr-3">{groups.map((r) => AFFILIATION_LABELS[r as Affiliation] ?? r).join(", ") || "—"}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{requirement(groups)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{peso(Number(p.price))}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{p.stock}</td>
                      <td className="py-2 text-xs capitalize">{p.status}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </ManagementShell>
  )
}
