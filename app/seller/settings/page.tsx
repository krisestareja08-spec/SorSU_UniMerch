import { requireDashboard } from "@/lib/dashboards"
import { SellerSettingsPage } from "./settings-client"

export default async function Page() {
  const ctx = await requireDashboard("seller", "settings")
  return <SellerSettingsPage ctx={ctx} />
}
