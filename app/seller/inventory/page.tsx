import { requireDashboard } from "@/lib/dashboards"
import { InventoryPage } from "@/components/store/inventory-page"

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string; filter?: string; q?: string }> }) {
  const ctx = await requireDashboard("seller", "inventory")
  return <InventoryPage ctx={ctx} {...(await searchParams)} />
}
