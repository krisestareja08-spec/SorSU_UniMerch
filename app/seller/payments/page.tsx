import { requireDashboard } from "@/lib/dashboards"
import { StorePayments } from "@/components/store/store-payments"

export default async function Page() {
  const ctx = await requireDashboard("seller", "payments")
  return <StorePayments ctx={ctx} />
}
