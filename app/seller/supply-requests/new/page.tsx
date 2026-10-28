import { requireDashboard } from "@/lib/dashboards"
import { SupplyRequestFormPage } from "@/components/store/supply-pages"

export default async function Page() {
  const ctx = await requireDashboard("seller", "supply")
  return <SupplyRequestFormPage ctx={ctx} />
}
