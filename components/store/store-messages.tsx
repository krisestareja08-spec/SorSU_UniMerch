import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { Inbox } from "@/components/messages/inbox"
import { MODULES, type DashboardCtx } from "@/lib/modules"

/** Buyer inquiries about the store's products. Shared by seller, cashier and supply-office dashboards. */
export function StoreMessages({ ctx, initialId }: { ctx: DashboardCtx; initialId?: string | null }) {
  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Buyer Messages" description="Questions from buyers about your products. Buyers are notified when you reply." />
      <div className="mt-6">
        <Inbox perspective="store" storeId={ctx.storeId} basePath={`${MODULES[ctx.module].basePath}/messages`} initialId={initialId}
          emptyHint="No buyer messages yet. Buyers can message you from any of your product pages." />
      </div>
    </ManagementShell>
  )
}
