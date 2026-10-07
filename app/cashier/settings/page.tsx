import { requireDashboard } from "@/lib/dashboards"
import { SellerSettingsPage } from "@/app/seller/settings/settings-client"

/** Cashier account settings: same personal details + password screen as the Seller dashboard. */
export default async function Page() {
  const ctx = await requireDashboard("cashier", "settings")
  return <SellerSettingsPage ctx={ctx} />
}
