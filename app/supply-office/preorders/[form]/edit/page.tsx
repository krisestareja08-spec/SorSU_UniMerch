import { requireDashboard } from "@/lib/dashboards"
import { PreorderFormEditPage } from "@/components/store/preorder-pages"

export default async function Page({ params }: { params: Promise<{ form: string }> }) {
  const ctx = await requireDashboard("supply_office", "orders")
  const { form } = await params
  return <PreorderFormEditPage ctx={ctx} formId={form} />
}
