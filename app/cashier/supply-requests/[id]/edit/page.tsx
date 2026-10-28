import { requireDashboard } from "@/lib/dashboards"
import { SupplyRequestFormPage } from "@/components/store/supply-pages"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireDashboard("cashier", "supply")
  const { id } = await params
  return <SupplyRequestFormPage ctx={ctx} requestId={id} />
}
