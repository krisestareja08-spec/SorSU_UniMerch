import { requireDashboard } from "@/lib/dashboards"
import { StoreBanners } from "@/components/store/store-banners"

export default async function Page() {
  const ctx = await requireDashboard("seller", "storefront")
  return <StoreBanners ctx={ctx} />
}
