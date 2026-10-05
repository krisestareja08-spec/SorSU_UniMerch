import { requireDashboard } from "@/lib/dashboards"
import { StoreBanners } from "@/components/store/store-banners"

export default async function Page() {
  const ctx = await requireDashboard("supply_office", "storefront")
  return <StoreBanners ctx={ctx} />
}
