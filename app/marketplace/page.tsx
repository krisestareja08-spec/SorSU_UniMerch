import { BannerCarousel } from "@/components/marketplace/banner-carousel"
import { CategoryGrid } from "@/components/marketplace/category-grid"
import { FlashSaleRail } from "@/components/marketplace/flash-sale-rail"
import { ProductGrid } from "@/components/marketplace/product-grid"

/** The marketplace is the same for every user; management happens inside dashboards. */
export default function MarketplacePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6">
      <BannerCarousel />
      <CategoryGrid />
      <FlashSaleRail />
      <ProductGrid title="Campus Marketplace" />
    </div>
  )
}
