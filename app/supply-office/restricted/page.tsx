import { requireDashboard } from "@/lib/dashboards"
import { RestrictedItemsPage } from "@/components/store/restricted-items-page"

export default async function Page() {
  const ctx = await requireDashboard("supply_office", "restricted")
  return <RestrictedItemsPage ctx={ctx} />
}
