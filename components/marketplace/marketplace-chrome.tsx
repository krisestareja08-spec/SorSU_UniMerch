import { redirect } from "next/navigation"
import { profileFromUser } from "@/lib/profile"
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header"
import { MarketplaceDesktopSidebar } from "@/components/marketplace/marketplace-desktop-sidebar"
import { MarketplaceBottomTabs } from "@/components/marketplace/marketplace-bottom-tabs"
import { CartProvider } from "@/lib/cart-context"
import { LiveAlerts } from "@/components/notifications/live-alerts"
import { getMyMemberships } from "@/lib/dashboards"
import { getCurrentUser, getProfileRow } from "@/lib/auth"
import type { DashboardSummary } from "@/lib/modules"
import { VerificationPrompt } from "@/components/verify/verification-prompt"
import { verificationState, type VerificationState } from "@/lib/verification-state"

/**
 * Buyer-facing chrome (header, user sidebar with "My dashboards", bottom tabs, cart).
 * Shared by /marketplace/* and the public seller storefront at /seller/[sellerId].
 */
export async function MarketplaceChrome({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  let dashboards: DashboardSummary[] = []
  let fullName: string | null = null
  let isVerified = false
  let affiliation: string | null = null
  let verification: VerificationState = "verified" // guests: nothing to show

  if (user) {
    const [profile, memberships] = await Promise.all([getProfileRow(user.id), getMyMemberships(user.id)])
    if (profile?.account_status === "banned") redirect("/auth/restricted")

    const resolved = profile ?? profileFromUser(user)
    dashboards = memberships.map(({ id, module, name, storeId, isMain }) => ({ id, module, name, storeId, isMain }))
    fullName = resolved.full_name ?? null
    isVerified = !!resolved.is_identity_verified
    affiliation = resolved.affiliation ?? null
    verification = verificationState(profile)
  }

  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <MarketplaceHeader dashboards={dashboards} fullName={fullName} isVerified={isVerified} affiliation={affiliation} verification={verification} />

      <div className="flex flex-1">
        {/* Desktop left sidebar — user navigation + "My dashboards" */}
        <MarketplaceDesktopSidebar dashboards={dashboards} verification={verification} />

        {/* Main content */}
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 overflow-x-clip pb-24 focus:outline-none lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom tabs */}
      <MarketplaceBottomTabs dashboards={dashboards} />
      {user && <LiveAlerts />}
      {/* Buyers who haven't applied for verification are invited to (dashboard accounts never shop) */}
      {user && dashboards.length === 0 && <VerificationPrompt userId={user.id} state={verification} />}
    </div>
    </CartProvider>
  )
}
