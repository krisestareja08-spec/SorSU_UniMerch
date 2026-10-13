import { requireDashboard } from "@/lib/dashboards"
import { PreorderFormsPage } from "@/components/store/preorder-pages"

export default async function Page() {
  const ctx = await requireDashboard("seller", "orders")
  return <PreorderFormsPage ctx={ctx} />
}
