import { requireDashboard } from "@/lib/dashboards"
import { PreorderFormsPage } from "@/components/store/preorder-pages"

export default async function Page() {
  const ctx = await requireDashboard("supply_office", "orders")
  return <PreorderFormsPage ctx={ctx} />
}
