import { requireDashboard } from "@/lib/dashboards"
import { BaoSettingsPage } from "./settings-client"

export default async function Page() {
  const ctx = await requireDashboard("bao", "settings")
  return <BaoSettingsPage ctx={ctx} />
}
