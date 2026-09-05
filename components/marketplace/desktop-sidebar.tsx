"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  LayoutGrid,
  PackageSearch,
  Store,
  Wallet,
  Settings,
  HelpCircle,
  ClipboardCheck,
  Archive,
  BarChart2,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/marketplace",            label: "Dashboard Home",        icon: Home },
  { href: "/marketplace/categories", label: "Categories",            icon: LayoutGrid },
  { href: "/marketplace/orders",     label: "My Orders",             icon: PackageSearch },
  { href: "/seller",                 label: "My Organisation Shop",  icon: Store },
  { href: "/marketplace/wallet",     label: "Wallet",                icon: Wallet },
  { href: "/bao",                    label: "Approvals",             icon: ClipboardCheck },
  { href: "/supply-office",          label: "Inventory",             icon: Archive },
  { href: "/marketplace/reports",    label: "Reports",               icon: BarChart2 },
  { href: "/marketplace/settings",   label: "Settings",              icon: Settings },
  { href: "/marketplace/help",       label: "Help Centre",           icon: HelpCircle },
]

export function DesktopSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-56 shrink-0 flex-col bg-primary lg:flex xl:w-64">
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto py-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/marketplace" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                active
                  ? "bg-primary-foreground/10 text-gold"
                  : "text-primary-foreground/75 hover:bg-primary-foreground/8 hover:text-primary-foreground",
              )}
            >
              {/* Active gold bar */}
              {active && (
                <span className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-gold" />
              )}
              <Icon className={cn("size-4 shrink-0", active ? "text-gold" : "text-gold/50 group-hover:text-gold/70")} />
              <span className="font-medium">{label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-primary-foreground/10 px-4 py-3">
        <p className="text-[11px] text-primary-foreground/40">UniMerch · Bulan Campus</p>
      </div>
    </aside>
  )
}
