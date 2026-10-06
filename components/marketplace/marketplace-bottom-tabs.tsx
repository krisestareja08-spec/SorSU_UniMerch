"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home, Store, ShoppingCart, Package, Tag, Users, LayoutDashboard,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { dashboardHref, type DashboardSummary } from "@/lib/modules"
import { useCart } from "@/lib/cart-context"

type Tab = { label: string; href: string; icon: LucideIcon; highlight?: boolean }

/**
 * Buyers: Stores · Cart · Market (centre) · Orders · Account.
 * Dashboard members (admins/staff) keep their original tabs, with Dashboard in place of Orders.
 */
function buildTabs(dashboards: DashboardSummary[]): Tab[] {
  if (dashboards.length > 0) {
    return [
      { label: "Market",    href: "/marketplace",            icon: Home },
      { label: "Browse",    href: "/marketplace/categories", icon: Tag },
      { label: "Cart",      href: "/marketplace/cart",       icon: ShoppingCart, highlight: true },
      { label: "Dashboard", href: dashboards.length === 1 ? dashboardHref(dashboards[0]) : "/dashboard", icon: LayoutDashboard },
      { label: "Account",   href: "/marketplace/account",    icon: Users },
    ]
  }
  return [
    { label: "Stores",   href: "/marketplace/stores",     icon: Store },
    { label: "Cart",     href: "/marketplace/cart",       icon: ShoppingCart },
    { label: "Market",   href: "/marketplace",            icon: Home, highlight: true },
    { label: "Orders",   href: "/marketplace/orders",     icon: Package },
    { label: "Account",  href: "/marketplace/account",    icon: Users },
  ]
}

export function MarketplaceBottomTabs({ dashboards = [] }: { dashboards?: DashboardSummary[] }) {
  const pathname = usePathname()
  const tabs = buildTabs(dashboards)
  const { itemCount } = useCart()

  function isActive(href: string) {
    if (href === "/marketplace") return pathname === "/marketplace"
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card shadow-[0_-2px_16px_rgba(0,0,0,0.07)] lg:hidden">
      <div className="mx-auto flex h-16 max-w-lg items-end justify-around px-2 pb-2 pt-1">
        {tabs.map((tab) => {
          const active = isActive(tab.href)
          const Icon = tab.icon
          return (
            <Link key={tab.label} href={tab.href}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition-all active:scale-95",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && <span className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-gold" />}
              {tab.highlight ? (
                <span className={cn(
                  "flex size-10 -mt-5 items-center justify-center rounded-2xl shadow-lg transition-all active:scale-95",
                  active ? "bg-primary" : "bg-primary/90 hover:bg-primary",
                )}>
                  <Icon className="size-5 text-primary-foreground" />
                </span>
              ) : (
                <span className="relative">
                  <Icon className="size-5" />
                  {tab.href === "/marketplace/cart" && itemCount > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[9px] font-bold text-primary">
                      {itemCount > 99 ? "99+" : itemCount}
                    </span>
                  )}
                </span>
              )}
              <span className={cn(tab.highlight && "mt-1")}>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
