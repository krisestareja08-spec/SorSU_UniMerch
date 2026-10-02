import Link from "next/link"
import { requireDashboard } from "@/lib/dashboards"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { CreateSellerForm } from "@/components/admin/create-seller-form"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default async function NewSellerPage() {
  const ctx = await requireDashboard("verification", "organizations")

  return (
    <ManagementShell ctx={ctx}>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4">
        <Link href="/admin/sellers"><ArrowLeft className="size-4" />Back to organizations</Link>
      </Button>
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
