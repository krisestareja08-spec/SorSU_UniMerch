import { requireUser } from "@/lib/auth"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { CreateSellerForm } from "@/components/registrar/create-seller-form"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function NewSellerPage() {
  const { email, profile } = await requireUser(["registrar", "admin"])

  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4">
        <Link href="/registrar"><ArrowLeft className="size-4" />Back</Link>
      </Button>
      <PageHeading
        title="Create Organization Seller"
        description="Register a new accredited organization as a marketplace seller. They will receive login credentials to manage their shop."
      />
      <div className="mt-6 max-w-lg">
        <CreateSellerForm />
      </div>
    </ManagementShell>
  )
}
