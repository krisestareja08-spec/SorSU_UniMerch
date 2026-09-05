"use server"

import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { SellerChatPanel } from "@/components/seller/chat-panel"

export default async function SellerChatPage() {
  const { id: sellerId, email, profile } = await requireUser(["seller", "admin"])
  const supabase = await createClient()

  const { data: products } = await supabase
    .from("products")
    .select("id, name, status, image_url")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })

  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading
        title="BAO Conversations"
        description="Messages from the Business Affairs Office about your product submissions."
      />
      <div className="mt-6">
        <SellerChatPanel products={products ?? []} sellerId={sellerId} />
      </div>
    </ManagementShell>
  )
}
