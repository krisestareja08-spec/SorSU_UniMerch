"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home, Store, ShoppingCart, Tag, Users, LayoutDashboard,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { type UserRole } from "@/lib/roles"

type Tab = { label: string; href: string; icon: LucideIcon; highlight?: boolean }

function buildTabs(role: UserRole): Tab[] {
  switch (role) {
    case "buyer": return [
      { label: "Home",       href: "/marketplace",         icon: Home },
      { label: "Categories", href: "/marketplace/categories", icon: Tag },
      { label: "Cart",       href: "/marketplace/cart",    icon: ShoppingCart, highlight: true },
      { label: "Orders",     href: "/marketplace/orders",  icon: Store },
      { label: "Profile",    href: "/marketplace/account", icon: Users },
    ]
    case "seller": return [
      { label: "Market",    href: "/marketplace",          icon: Home },
      { label: "Products",  href: "/seller/products",      icon: Tag },
      { label: "Dashboard", href: "/seller",               icon: LayoutDashboard, highlight: true },
      { label: "Orders",    href: "/seller/orders",        icon: ShoppingCart },
      { label: "Profile",   href: "/seller/settings",      icon: Users },
    ]
    case "bao":
    case "admin": return [
      { label: "Market",   href: "/marketplace",    icon: Home },
      { label: "Dashboard",href: "/bao",            icon: LayoutDashboard, highlight: true },
      { label: "Sellers",  href: "/bao/sellers",    icon: Store },
      { label: "Reports",  href: "/bao/reports",    icon: Tag },
      { label: "Profile",  href: "/bao/settings",   icon: Users },
    ]
    case "supply_office": return [
      { label: "Market",    href: "/marketplace",             icon: Home },
      { label: "Dashboard", href: "/supply-office",           icon: LayoutDashboard, highlight: true },
      { label: "Inventory", href: "/supply-office/inventory", icon: Tag },
      { label: "Reports",   href: "/supply-office/reports",   icon: Store },
      { label: "Profile",   href: "/supply-office/settings",  icon: Users },
    ]
    case "registrar": return [
      { label: "Market",   href: "/marketplace",              icon: Home },
      { label: "Dashboard",href: "/registrar",                icon: LayoutDashboard, highlight: true },
      { label: "Queue",    href: "/registrar/verification",   icon: Tag },
      { label: "Reports",  href: "/registrar/reports",        icon: Store },
      { label: "Profile",  href: "/registrar/settings",       icon: Users },
    ]
    default: return []
  }
}

export function MarketplaceBottomTabs({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const tabs = buildTabs(role)

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
            <Link key={tab.href} href={tab.href}
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
                <Icon className="size-5" />
              )}
              <span className={cn(tab.highlight && "mt-1")}>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
