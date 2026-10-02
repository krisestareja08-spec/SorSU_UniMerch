import { requireDashboard } from "@/lib/dashboards"
import { OfficeHome } from "@/components/store/office-home"

/** A Cashier branch — secondary seller of uniforms and university merchandise for its campus / department. */
export default async function CashierPage() {
  const ctx = await requireDashboard("cashier")
  return (
    <OfficeHome
      ctx={ctx}
      title={ctx.dashboardName}
      description="Uniforms and university merchandise sold by this cashier branch: stock, sales, orders and restricted items."
    />
  )
}
