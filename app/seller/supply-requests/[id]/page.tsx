import { requireDashboard } from "@/lib/dashboards"
import { SupplyRequestDetailPage } from "@/components/store/supply-pages"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireDashboard("seller", "supply")
  const { id } = await params
  return <SupplyRequestDetailPage ctx={ctx} id={id} />
}
