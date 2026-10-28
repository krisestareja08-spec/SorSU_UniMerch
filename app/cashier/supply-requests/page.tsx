import { requireDashboard } from "@/lib/dashboards"
import { SupplyRequestsPage } from "@/components/store/supply-pages"

export default async function Page() {
  const ctx = await requireDashboard("cashier", "supply")
  return <SupplyRequestsPage ctx={ctx} />
}
