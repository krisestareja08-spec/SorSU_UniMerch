import { HomeBanners } from "@/components/marketplace/home-banners"
import { CategoryGrid } from "@/components/marketplace/category-grid"
import { ProductGrid } from "@/components/marketplace/product-grid"

/** The marketplace is the same for every user; management happens inside dashboards. */
export default function MarketplacePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6">
      <HomeBanners />
      <CategoryGrid />
      <ProductGrid title="Campus Marketplace" />
    </div>
  )
}
