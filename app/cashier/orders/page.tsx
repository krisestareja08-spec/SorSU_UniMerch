import { requireDashboard } from "@/lib/dashboards"
import { StoreOrders } from "@/components/store/store-orders"

export default async function Page() {
  const ctx = await requireDashboard("cashier", "orders")
  return <StoreOrders ctx={ctx} />
}
