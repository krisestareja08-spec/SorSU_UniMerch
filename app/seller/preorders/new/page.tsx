import { requireDashboard } from "@/lib/dashboards"
import { PreorderFormEditPage } from "@/components/store/preorder-pages"

export default async function Page() {
  const ctx = await requireDashboard("seller", "orders")
  return <PreorderFormEditPage ctx={ctx} />
}
