import { ProductGrid } from "@/components/marketplace/product-grid"
import { CategoryGrid } from "@/components/marketplace/category-grid"
import { StoreDirectory } from "@/components/storefront/store-directory"

export default function CategoriesPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">Browse Categories</h1>
        <p className="mt-1 text-sm text-muted-foreground">Find campus goods by department, type, or org.</p>
        <div className="mt-2 h-px bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />
      </div>
      <CategoryGrid />
      <StoreDirectory />
      <ProductGrid title="All Products" />
    </div>
  )
}
