import { requireDashboard } from "@/lib/dashboards"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { CreateSellerForm } from "@/components/admin/create-seller-form"
import { BackLink } from "@/components/navigation/history-nav"

export default async function NewSellerPage() {
  const ctx = await requireDashboard("verification", "organizations")

  return (
    <ManagementShell ctx={ctx}>
      <BackLink href="/admin/sellers" className="mb-4 -ml-2 rounded-lg px-2 py-1.5 font-medium text-foreground hover:bg-muted" />
      <PageHeading
        title="Create Organization"
        description="Register an accredited organization. It gets its own storefront and Seller Dashboard; you appoint the dashboard's Main Admin."
      />
      <div className="mt-6 max-w-lg">
        <CreateSellerForm />
      </div>
    </ManagementShell>
  )
}
