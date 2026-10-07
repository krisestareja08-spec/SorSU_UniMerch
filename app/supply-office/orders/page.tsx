import { requireDashboard } from "@/lib/dashboards"
import { StoreOrders } from "@/components/store/store-orders"

/** Same order screen as the Cashier: walk-in counter payments first, online orders too. */
export default async function Page() {
  const ctx = await requireDashboard("supply_office", "orders")
  return <StoreOrders ctx={ctx} />
}
