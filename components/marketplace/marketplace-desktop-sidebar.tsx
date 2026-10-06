"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Store, Tag, ShoppingCart, MessageCircle, Bell, Users, Settings, Building2, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { MODULES, dashboardHref, type DashboardSummary } from "@/lib/modules"

type NavItem = { label: string; href: string; icon: LucideIcon }

/** Every signed-in person is a user; the same user navigation for everyone. */
const USER_NAV: NavItem[] = [
  { label: "Home",         href: "/marketplace",            icon: Home },
  { label: "Stores",       href: "/marketplace/stores",     icon: Store },
  { label: "Categories",   href: "/marketplace/categories", icon: Tag },
  { label: "My Orders",    href: "/marketplace/orders",     icon: ShoppingCart },
  { label: "Messages",     href: "/marketplace/messages",   icon: MessageCircle },
  { label: "Notifications", href: "/marketplace/notifications", icon: Bell },
  { label: "My Account",   href: "/marketplace/account",    icon: Users },
  // Account & Security and Verification live under Settings
  { label: "Settings",     href: "/marketplace/settings",   icon: Settings },
]

export function MarketplaceDesktopSidebar({ dashboards = [] }: { dashboards?: DashboardSummary[] }) {
  const pathname = usePathname()
  const nav = USER_NAV

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

      {dashboards.length > 0 && (
        <div className="px-2 pb-3">
          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/45">My dashboards</p>
          {dashboards.map((d) => (
            <a key={d.id} href={dashboardHref(d)}
              className="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-primary-foreground/75 hover:bg-primary-foreground/8 hover:text-primary-foreground">
              <Building2 className="size-4 shrink-0 text-gold/60 group-hover:text-gold/80" />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate font-medium">{d.name}</span>
                <span className="block text-[10px] text-primary-foreground/50">{MODULES[d.module].name}{d.isMain ? " · Main Admin" : ""}</span>
              </span>
            </a>
          ))}
        </div>
      )}

      <div className="h-px bg-gradient-to-r from-gold/40 to-transparent mx-3" />
      <div className="px-4 py-3">
        <p className="text-[10px] text-primary-foreground/40">UniMerch · Bulan Campus</p>
      </div>
    </aside>
  )
}
