import { createClient } from "@/lib/supabase/server"
import { profileFromUser } from "@/lib/profile"
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header"
import { MarketplaceDesktopSidebar } from "@/components/marketplace/marketplace-desktop-sidebar"
import { MarketplaceBottomTabs } from "@/components/marketplace/marketplace-bottom-tabs"
import { CartProvider } from "@/lib/cart-context"
import { getMemberships } from "@/lib/dashboards"
import { redirectIfBanned } from "@/lib/auth"
import type { DashboardSummary } from "@/lib/modules"

/**
 * Buyer-facing chrome (header, user sidebar with "My dashboards", bottom tabs, cart).
 * Shared by /marketplace/* and the public seller storefront at /seller/[sellerId].
 */
export async function MarketplaceChrome({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let dashboards: DashboardSummary[] = []
  let fullName: string | null = null
  let isVerified = false
  let affiliation: string | null = null

  if (user) {
    await redirectIfBanned(supabase, user.id)
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, affiliation, is_identity_verified")
      .eq("id", user.id)
      .maybeSingle()

    const resolved = profile ?? profileFromUser(user)
    dashboards = (await getMemberships(supabase, user.id)).map(({ id, module, name, storeId, isMain }) => ({ id, module, name, storeId, isMain }))
    fullName = resolved.full_name ?? null
    isVerified = !!resolved.is_identity_verified
    affiliation = resolved.affiliation ?? null
  }

  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <MarketplaceHeader dashboards={dashboards} fullName={fullName} isVerified={isVerified} affiliation={affiliation} />

      <div className="flex flex-1">
        {/* Desktop left sidebar — user navigation + "My dashboards" */}
        <MarketplaceDesktopSidebar dashboards={dashboards} />

        {/* Main content */}
        <main className="flex-1 overflow-x-hidden pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom tabs */}
      <MarketplaceBottomTabs dashboards={dashboards} />
    </div>
    </CartProvider>
  )
}
