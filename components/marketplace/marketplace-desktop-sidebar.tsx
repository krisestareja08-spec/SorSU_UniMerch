"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home, Store, ShoppingCart, Tag, Boxes, BarChart2, Settings,
  Users, ShieldCheck, FileText, ClipboardList, CheckSquare,
  TrendingUp, LayoutDashboard, type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { roleDashboard, type UserRole } from "@/lib/roles"

type NavItem = { label: string; href: string; icon: LucideIcon }

function buildNav(role: UserRole): NavItem[] {
  const marketItem = { label: "Marketplace", href: "/marketplace", icon: Home }
  const dash = roleDashboard(role)

  const roleNav: Record<UserRole, NavItem[]> = {
    buyer: [
      { label: "Home",       href: "/marketplace",        icon: Home },
      { label: "Categories", href: "/marketplace/categories", icon: Tag },
      { label: "My Orders",  href: "/marketplace/orders", icon: ShoppingCart },
      { label: "Account",    href: "/marketplace/account",icon: Users },
      { label: "Settings",   href: "/marketplace/settings",icon: Settings },
    ],
    seller: [
      marketItem,
      { label: "My Dashboard",  href: "/seller",           icon: LayoutDashboard },
      { label: "My Products",   href: "/seller/products",  icon: Tag },
      { label: "Orders",        href: "/seller/orders",    icon: ShoppingCart },
      { label: "Inventory",     href: "/seller/inventory", icon: Boxes },
      { label: "Analytics",     href: "/seller/analytics", icon: BarChart2 },
      { label: "Shop Settings", href: "/seller/shop",      icon: Store },
      { label: "Settings",      href: "/seller/settings",  icon: Settings },
    ],
    bao: [
      marketItem,
      { label: "BAO Dashboard",    href: "/bao",           icon: LayoutDashboard },
      { label: "Seller Management",href: "/bao/sellers",   icon: Users },
      { label: "Product Approvals",href: "/bao/approvals", icon: CheckSquare },
      { label: "Analytics",        href: "/bao/analytics", icon: BarChart2 },
      { label: "Reports",          href: "/bao/reports",   icon: FileText },
      { label: "Activity Logs",    href: "/bao/logs",      icon: ClipboardList },
      { label: "Settings",         href: "/bao/settings",  icon: Settings },
    ],
    admin: [
      marketItem,
      { label: "BAO Dashboard",    href: "/bao",           icon: LayoutDashboard },
      { label: "Seller Management",href: "/bao/sellers",   icon: Users },
      { label: "Product Approvals",href: "/bao/approvals", icon: CheckSquare },
      { label: "Analytics",        href: "/bao/analytics", icon: BarChart2 },
      { label: "Reports",          href: "/bao/reports",   icon: FileText },
      { label: "Activity Logs",    href: "/bao/logs",      icon: ClipboardList },
      { label: "Settings",         href: "/bao/settings",  icon: Settings },
    ],
    supply_office: [
      marketItem,
      { label: "Supply Dashboard", href: "/supply-office",           icon: LayoutDashboard },
      { label: "Inventory",        href: "/supply-office/inventory", icon: Boxes },
      { label: "Stock Movement",   href: "/supply-office/movement",  icon: TrendingUp },
      { label: "Restricted Items", href: "/supply-office/restricted",icon: ShieldCheck },
      { label: "Reports",          href: "/supply-office/reports",   icon: FileText },
      { label: "Settings",         href: "/supply-office/settings",  icon: Settings },
    ],
    registrar: [
      marketItem,
      { label: "Registrar Home",   href: "/registrar",              icon: LayoutDashboard },
      { label: "Verify Queue",     href: "/registrar/verification", icon: ShieldCheck },
      { label: "Approved",         href: "/registrar/approved",     icon: CheckSquare },
      { label: "Reports",          href: "/registrar/reports",      icon: FileText },
      { label: "Settings",         href: "/registrar/settings",     icon: Settings },
    ],
  }

  return roleNav[role] ?? roleNav.buyer
}

export function MarketplaceDesktopSidebar({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const nav = buildNav(role)

  function isActive(href: string) {
    if (href === "/marketplace") return pathname === "/marketplace"
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 flex-col self-start overflow-y-auto border-r border-primary/15 bg-primary shadow-sm lg:flex sm:top-16 sm:h-[calc(100vh-4rem)] xl:w-64">
      <nav className="flex flex-1 flex-col gap-0.5 py-3 px-2">
        {nav.map((item) => {
          const active = isActive(item.href)
          const Icon = item.icon
          return (
            <Link key={item.href + item.label} href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-primary-foreground/12 text-gold"
                  : "text-primary-foreground/70 hover:bg-primary-foreground/8 hover:text-primary-foreground",
              )}
            >
              {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-gold" />}
              <Icon className={cn("size-4 shrink-0", active ? "text-gold" : "text-gold/50 group-hover:text-gold/70")} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="h-px bg-gradient-to-r from-gold/40 to-transparent mx-3" />
      <div className="px-4 py-3">
        <p className="text-[10px] text-primary-foreground/40">UniMerch · Bulan Campus</p>
      </div>
    </aside>
  )
}
