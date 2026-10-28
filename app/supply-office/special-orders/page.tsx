import { requireDashboard } from "@/lib/dashboards"
import { SpecialOrdersPage } from "@/components/store/supply-pages"

export default async function Page() {
  const ctx = await requireDashboard("supply_office", "supply")
  return <SpecialOrdersPage ctx={ctx} />
}
