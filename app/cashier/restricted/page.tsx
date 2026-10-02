import { requireDashboard } from "@/lib/dashboards"
import { RestrictedItemsPage } from "@/components/store/restricted-items-page"

export default async function Page() {
  const ctx = await requireDashboard("cashier", "restricted")
  return <RestrictedItemsPage ctx={ctx} />
}
