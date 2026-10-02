import { requireDashboard } from "@/lib/dashboards"
import { InventoryPage } from "@/components/store/inventory-page"

export default async function Page() {
  const ctx = await requireDashboard("cashier", "inventory")
  return <InventoryPage ctx={ctx} />
}
