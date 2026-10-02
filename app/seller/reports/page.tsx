import { requireDashboard } from "@/lib/dashboards"
import { SalesReportsPage } from "@/components/store/sales-reports-page"

export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const ctx = await requireDashboard("seller", "reports")
  const { from, to } = await searchParams
  return <SalesReportsPage ctx={ctx} from={from} to={to} />
}
