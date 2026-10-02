import { requireDashboard } from "@/lib/dashboards"
import { SupplyOfficeSettingsPage } from "./settings-client"

export default async function Page() {
  const ctx = await requireDashboard("supply_office", "settings")
  return <SupplyOfficeSettingsPage ctx={ctx} />
}
