import { createClient } from "@/lib/supabase/server"
import { profileFromUser } from "@/lib/profile"
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header"
import { MarketplaceDesktopSidebar } from "@/components/marketplace/marketplace-desktop-sidebar"
import { MarketplaceBottomTabs } from "@/components/marketplace/marketplace-bottom-tabs"
import { CartProvider } from "@/lib/cart-context"
import type { UserRole } from "@/lib/roles"

export default async function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let role: UserRole = "buyer"
  let fullName: string | null = null

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .maybeSingle()

    const resolved = profile ?? profileFromUser(user)
    role = (resolved.role as UserRole) ?? "buyer"
    fullName = resolved.full_name ?? null
  }

  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <MarketplaceHeader role={role} fullName={fullName} />

      <div className="flex flex-1">
        {/* Desktop left sidebar — role-aware */}
        <MarketplaceDesktopSidebar role={role} />

        {/* Main content */}
        <main className="flex-1 overflow-x-hidden pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom tabs — role-aware */}
      <MarketplaceBottomTabs role={role} />
    </div>
    </CartProvider>
  )
}
