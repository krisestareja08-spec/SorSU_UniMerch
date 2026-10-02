import { requireDashboard } from "@/lib/dashboards"
import { StoreShop } from "@/components/store/store-shop"

export default async function Page() {
  const ctx = await requireDashboard("seller", "storefront")
  return <StoreShop ctx={ctx} />
}
