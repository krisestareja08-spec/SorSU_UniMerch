import { requireDashboard } from "@/lib/dashboards"
import { OfficeHome } from "@/components/store/office-home"

export default async function SupplyOfficePage() {
  const ctx = await requireDashboard("supply_office")
  return <OfficeHome ctx={ctx} title="Supply Office" description="Inventory, stock movement, orders and restricted items for the University Supply Office store." />
}
