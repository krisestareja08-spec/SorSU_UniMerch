"use server"

import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { SellerChatPanel } from "@/components/seller/chat-panel"

export default async function SellerChatPage() {
  const ctx = await requireDashboard("seller", "messages")
  const sellerId = ctx.storeId ?? ""
  const supabase = await createClient()

  const { data: products } = await supabase
    .from("products")
    .select("id, name, status, image_url")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading
        title="BAO Conversations"
        description="Messages from the Business Affairs Office about your product submissions."
      />
      <div className="mt-6">
        <SellerChatPanel products={products ?? []} sellerId={ctx.userId} />
      </div>
    </ManagementShell>
  )
}
