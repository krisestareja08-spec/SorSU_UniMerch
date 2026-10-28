import { requireDashboard } from "@/lib/dashboards"
import { BranchInventoryPage } from "@/components/store/branch-inventory-page"

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; branch?: string }> }) {
  const ctx = await requireDashboard("supply_office", "inventory")
  const { tab, branch } = await searchParams
  return <BranchInventoryPage ctx={ctx} tab={tab === "stock" || tab === "collab" ? tab : "requests"} branchId={branch} />
}
