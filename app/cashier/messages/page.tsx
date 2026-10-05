import { requireDashboard } from "@/lib/dashboards"
import { StoreMessages } from "@/components/store/store-messages"

export default async function Page({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const ctx = await requireDashboard("cashier", "messages")
  const { c } = await searchParams
  return <StoreMessages ctx={ctx} initialId={c} />
}
