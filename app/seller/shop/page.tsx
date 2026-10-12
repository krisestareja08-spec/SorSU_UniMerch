import { requireDashboard } from "@/lib/dashboards"
import { StorefrontOverview } from "@/components/store/storefront-overview"

export default async function Page({ searchParams }: { searchParams: Promise<{ edit?: string; category?: string; page?: string }> }) {
  const ctx = await requireDashboard("seller", "storefront")
  return <StorefrontOverview ctx={ctx} searchParams={await searchParams} />
}
