import { requireDashboard } from "@/lib/dashboards"
import { StoreShop } from "@/components/store/store-shop"

export default async function Page() {
  const ctx = await requireDashboard("supply_office", "storefront")
  return <StoreShop ctx={ctx} />
}
