import { requireDashboard } from "@/lib/dashboards"
import { PreorderFormEditPage } from "@/components/store/preorder-pages"

export default async function Page() {
  const ctx = await requireDashboard("cashier", "orders")
  return <PreorderFormEditPage ctx={ctx} />
}
