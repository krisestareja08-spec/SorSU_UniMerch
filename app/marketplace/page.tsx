import { createClient } from "@/lib/supabase/server"
import { profileFromUser } from "@/lib/profile"
import { BannerCarousel } from "@/components/marketplace/banner-carousel"
import { CategoryGrid } from "@/components/marketplace/category-grid"
import { FlashSaleRail } from "@/components/marketplace/flash-sale-rail"
import { ProductGrid } from "@/components/marketplace/product-grid"
import type { UserRole } from "@/lib/roles"

// Role-specific banner shown at the top of the marketplace
const ROLE_BANNERS: Partial<Record<UserRole, { text: string; color: string }>> = {
  bao:           { text: "👑 BAO Admin View — you can approve/decline listings and see royalty analytics.", color: "bg-primary/10 border-primary/20 text-primary" },
  admin:         { text: "👑 BAO Admin View — you can approve/decline listings and see royalty analytics.", color: "bg-primary/10 border-primary/20 text-primary" },
  seller:        { text: "🛍️ Seller View — click 'Manage Listing' on your products to edit them.", color: "bg-gold/10 border-gold/20 text-amber-700 dark:text-gold" },
  supply_office: { text: "📦 Supply Office View — use 'Update Stock' to manage inventory levels.", color: "bg-primary/8 border-primary/15 text-primary" },
  registrar:     { text: "🏫 Registrar View — read-only marketplace access. Use your dashboard for verifications.", color: "bg-muted border-border text-muted-foreground" },
}

export default async function MarketplacePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let role: UserRole = "buyer"
  if (user) {
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).maybeSingle()
    const resolved = profile ?? profileFromUser(user)
    role = (resolved.role as UserRole) ?? "buyer"
  }

  const roleBanner = ROLE_BANNERS[role]

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6">
      {/* Role context banner */}
      {roleBanner && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${roleBanner.color}`}>
          {roleBanner.text}
        </div>
      )}

      <BannerCarousel />
      <CategoryGrid />
      <FlashSaleRail />
      <ProductGrid title="Campus Marketplace" viewerRole={role} />
    </div>
  )
}
