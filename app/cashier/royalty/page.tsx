import { requireDashboard } from "@/lib/dashboards"
import { RoyaltyPage } from "@/components/store/royalty-page"

export default async function Page() {
  const ctx = await requireDashboard("cashier", "reports")
  return <RoyaltyPage ctx={ctx} />
}
