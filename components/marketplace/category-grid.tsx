import Link from "next/link"
import {
  Shirt,
  GraduationCap,
  ShoppingBag,
  Link2,
  BookOpen,
  Ticket,
  Coffee,
  Layers,
  Briefcase,
  Package,
  Star,
  Grid2x2,
  Store,
} from "lucide-react"
import { cn } from "@/lib/utils"

const CATEGORIES = [
  { label: "Shirts",          icon: Shirt,        slug: "shirts" },
  { label: "Uniforms",        icon: GraduationCap,slug: "uniforms" },
  { label: "Merchandise",     icon: ShoppingBag,  slug: "merchandise" },
  { label: "ID Lace",         icon: Link2,        slug: "id-lace" },
  { label: "Dept Merch",      icon: BookOpen,     slug: "dept-merch" },
  { label: "Event Tickets",   icon: Ticket,       slug: "tickets" },
  { label: "Food Booths",     icon: Coffee,       slug: "food" },
  { label: "Supplies",        icon: Layers,       slug: "supplies" },
  { label: "Hoodies",         icon: Briefcase,    slug: "hoodies" },
  { label: "Tumblers",        icon: Package,      slug: "tumblers" },
  { label: "Featured",        icon: Star,         slug: "featured" },
  { label: "Stores",          icon: Store,        slug: "#stores" },
  { label: "All Items",       icon: Grid2x2,      slug: null },
]

export function CategoryGrid() {
  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-base font-semibold text-foreground sm:text-lg">Categories</h2>
        <Link href="/marketplace/categories" className="text-xs font-medium text-gold hover:underline">
          See all
        </Link>
      </div>
      {/* Gold section divider */}
      <div className="mb-4 mt-1.5 h-px bg-gradient-to-r from-gold/60 via-gold/20 to-transparent" />

      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-6">
        {CATEGORIES.map(({ label, icon: Icon, slug }) => (
          <Link
            key={label}
            href={slug?.startsWith("#") ? `/marketplace/categories${slug}` : slug ? `/marketplace/categories/${slug}` : "/marketplace/categories"}
            className="group flex flex-col items-center gap-2"
          >
            <div className={cn(
              "flex size-12 items-center justify-center rounded-2xl bg-gold shadow-sm transition-all",
              "group-hover:scale-110 group-hover:shadow-md group-hover:shadow-gold/20 active:scale-95",
            )}>
              <Icon className="size-5 text-primary" strokeWidth={2} />
            </div>
            <span className="text-center text-[11px] font-medium leading-tight text-foreground/80 group-hover:text-primary">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
