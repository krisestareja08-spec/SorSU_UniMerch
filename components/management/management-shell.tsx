"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ROLE_LABELS, type UserRole } from "@/lib/roles"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  ShieldCheck,
  Wallet,
  Package,
  Store,
  Users,
  Settings,
  BarChart2,
  ClipboardList,
  FileText,
  Bell,
  Search,
  CreditCard,
  Boxes,
  Tag,
  ShoppingCart,
  MessageCircle,
  CheckSquare,
  TrendingUp,
  Home,
  type LucideIcon,
} from "lucide-react"

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
}

const MODULES: Record<UserRole, { moduleName: string; nav: NavItem[]; bottomTabs: NavItem[] }> = {
  registrar: {
    moduleName: "Registrar",
    nav: [
      { label: "Marketplace",        href: "/marketplace",               icon: Store },
      { label: "Overview",            href: "/registrar",                 icon: LayoutDashboard },
      { label: "Products",            href: "/registrar/products",        icon: Tag },
      { label: "Orders",              href: "/registrar/orders",          icon: ShoppingCart },
      { label: "Verification Queue",  href: "/registrar/verification",    icon: ShieldCheck },
      { label: "New Seller",          href: "/registrar/new-seller",      icon: Users },
      { label: "Analytics",           href: "/registrar/reports",         icon: BarChart2 },
      { label: "Settings",            href: "/registrar/settings",        icon: Settings },
    ],
    bottomTabs: [
      { label: "Market",    href: "/marketplace",             icon: Store },
      { label: "Home",      href: "/registrar",               icon: Home },
      { label: "Products",  href: "/registrar/products",      icon: Tag },
      { label: "Orders",    href: "/registrar/orders",        icon: ShoppingCart },
      { label: "Profile",   href: "/registrar/settings",      icon: Users },
    ],
  },
  bao: {
    moduleName: "BAO Admin",
    nav: [
      { label: "Marketplace",       href: "/marketplace",    icon: Store },
      { label: "Dashboard",         href: "/bao",            icon: LayoutDashboard },
      { label: "Seller Management", href: "/bao/sellers",    icon: Users },
      { label: "Product Approvals", href: "/bao/approvals",  icon: CheckSquare },
      { label: "Analytics",         href: "/bao/analytics",  icon: BarChart2 },
      { label: "Reports",           href: "/bao/reports",    icon: FileText },
      { label: "Logs",              href: "/bao/logs",       icon: ClipboardList },
      { label: "Settings",          href: "/bao/settings",   icon: Settings },
    ],
    bottomTabs: [
      { label: "Market",  href: "/marketplace", icon: Store },
      { label: "Home",    href: "/bao",         icon: Home },
      { label: "Sellers", href: "/bao/sellers", icon: Users },
      { label: "Reports", href: "/bao/reports", icon: FileText },
      { label: "Profile", href: "/bao/settings",icon: Users },
    ],
  },
  supply_office: {
    moduleName: "Supply Office",
    nav: [
      { label: "Marketplace",      href: "/marketplace",               icon: Store },
      { label: "Dashboard",        href: "/supply-office",             icon: LayoutDashboard },
      { label: "Products",         href: "/supply-office/products",    icon: Tag },
      { label: "Orders",           href: "/supply-office/orders",      icon: ShoppingCart },
      { label: "Inventory",        href: "/supply-office/inventory",   icon: Boxes },
      { label: "Analytics",        href: "/supply-office/reports",     icon: BarChart2 },
      { label: "Settings",         href: "/supply-office/settings",    icon: Settings },
    ],
    bottomTabs: [
      { label: "Market",    href: "/marketplace",              icon: Store },
      { label: "Home",      href: "/supply-office",            icon: Home },
      { label: "Products",  href: "/supply-office/products",   icon: Tag },
      { label: "Orders",    href: "/supply-office/orders",     icon: ShoppingCart },
      { label: "Profile",   href: "/supply-office/settings",   icon: Users },
    ],
  },
  seller: {
    moduleName: "Seller Center",
    nav: [
      { label: "Marketplace",   href: "/marketplace",     icon: Store },
      { label: "Dashboard",     href: "/seller",          icon: LayoutDashboard },
      { label: "Products",      href: "/seller/products", icon: Tag },
      { label: "Orders",        href: "/seller/orders",   icon: ShoppingCart },
      { label: "Shop Settings", href: "/seller/shop",     icon: Store },
      { label: "Settings",      href: "/seller/settings", icon: Settings },
    ],
    bottomTabs: [
      { label: "Market",   href: "/marketplace",     icon: Store },
      { label: "Home",     href: "/seller",          icon: Home },
      { label: "Products", href: "/seller/products", icon: Tag },
      { label: "Orders",   href: "/seller/orders",   icon: ShoppingCart },
      { label: "Profile",  href: "/seller/settings", icon: Users },
    ],
  },
  admin: {
    moduleName: "BAO Admin",
    nav: [
      { label: "Marketplace",   href: "/marketplace",    icon: Store },
      { label: "Dashboard",     href: "/bao",            icon: LayoutDashboard },
      { label: "Marketplace View",  href: "/bao/marketplace", icon: Store },
      { label: "Seller Management", href: "/bao/sellers",     icon: Users },
      { label: "Product Approvals", href: "/bao/approvals",   icon: CheckSquare },
      { label: "Analytics",         href: "/bao/analytics",   icon: BarChart2 },
      { label: "Reports",           href: "/bao/reports",     icon: FileText },
      { label: "Logs",              href: "/bao/logs",        icon: ClipboardList },
      { label: "Settings",          href: "/bao/settings",    icon: Settings },
    ],
    bottomTabs: [
      { label: "Market",    href: "/marketplace",    icon: Store },
      { label: "Home",      href: "/bao",            icon: Home },
      { label: "Sellers",   href: "/bao/sellers",    icon: Users },
      { label: "Reports",   href: "/bao/reports",    icon: FileText },
      { label: "Profile",   href: "/bao/settings",   icon: Users },
    ],
  },
  buyer: {
    moduleName: "Marketplace",
    nav: [
      { label: "Dashboard",   href: "/dashboard",           icon: LayoutDashboard },
      { label: "Marketplace", href: "/marketplace",         icon: Store },
      { label: "My Orders",   href: "/marketplace/orders",  icon: ShoppingCart },
      { label: "Settings",    href: "/marketplace/settings",icon: Settings },
    ],
    bottomTabs: [
      { label: "Home",    href: "/dashboard",           icon: Home },
      { label: "Market",  href: "/marketplace",         icon: Store },
      { label: "Orders",  href: "/marketplace/orders",  icon: ShoppingCart },
      { label: "Profile", href: "/marketplace/account", icon: Users },
    ],
  },
}

export function ManagementShell({
  role,
  fullName,
  email,
  children,
}: {
  role: UserRole
  fullName: string | null
  email: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { moduleName, nav, bottomTabs } = MODULES[role]

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  const initials =
    (fullName || email)
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U"

  function isActive(href: string, index: number) {
    if (href === "/bao" || href === "/seller" || href === "/supply-office" || href === "/registrar" || href === "/admin" || href === "/dashboard") {
      return pathname === href
    }
    return pathname === href || pathname.startsWith(href + "/")
  }

  // ─── Sidebar inner content (shared desktop + drawer) ────────────────────────
  const SidebarContent = (
    <div className="flex h-full flex-col bg-primary text-primary-foreground">
      {/* Module label */}
      <div className="px-4 pb-2 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-primary-foreground/50">{moduleName}</p>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto py-3 px-2">
        {nav.map((item, i) => {
          const active = isActive(item.href, i)
          const Icon = item.icon
          return (
            <Link key={item.href + item.label} href={item.href}
              onClick={() => setDrawerOpen(false)}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-primary-foreground/12 text-gold"
                  : "text-primary-foreground/75 hover:bg-primary-foreground/8 hover:text-primary-foreground",
              )}
            >
              {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-gold" />}
              <Icon className={cn("size-4 shrink-0", active ? "text-gold" : "text-gold/50 group-hover:text-gold/70")} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Gold divider */}
      <div className="h-px bg-linear-to-r from-gold/40 to-transparent mx-3" />

      {/* User footer */}
      <div className="flex items-center gap-3 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-bold text-primary">
          {initials}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium text-primary-foreground">{fullName || "Staff"}</p>
          <p className="truncate text-xs text-primary-foreground/60">{ROLE_LABELS[role]}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out"
          className="text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground">
          <LogOut className="size-4" />
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* ── Desktop sidebar (fixed, always visible ≥ lg) ────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-primary/20 shadow-lg lg:block">
        {SidebarContent}
      </aside>

      {/* ── Mobile drawer backdrop ───────────────────────────────────────────── */}
      <div onClick={() => setDrawerOpen(false)}
        className={cn(
          "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity lg:hidden",
          drawerOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )} aria-hidden />

      {/* ── Mobile drawer panel ──────────────────────────────────────────────── */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 shadow-2xl transition-transform duration-300 lg:hidden",
        drawerOpen ? "translate-x-0" : "-translate-x-full",
      )}>
        <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(false)}
          aria-label="Close menu"
          className="absolute right-2 top-3 z-10 text-primary-foreground/70 hover:bg-primary-foreground/10">
          <X className="size-4" />
        </Button>
        {SidebarContent}
      </div>

      {/* ── Main content area ─────────────────────────────────────────────────── */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        {/* Top bar — desktop + mobile */}
        <header className="sticky top-0 z-20 border-b border-border bg-card/95 shadow-sm backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            {/* Hamburger — mobile only */}
            <button onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
              aria-label="Open menu">
              <Menu className="size-5" />
            </button>

            {/* Logo — always visible in header */}
            <Link href="/marketplace" className="flex shrink-0 items-center gap-2">
              <Image src="/sorsu-seal.png" alt="SorSU seal" width={28} height={28} className="rounded-full ring-1 ring-border" />
              <span className="font-serif text-sm font-semibold">
                Uni<span className="text-gold">Merch</span>
              </span>
            </Link>

            {/* Search — only shown on the marketplace page */}
            {pathname.startsWith("/marketplace") && (
              <div className="relative hidden flex-1 max-w-sm lg:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input type="search" placeholder="Search…"
                  className="h-8 w-full rounded-lg border border-border bg-muted/40 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              {/* Role badge */}
              <Badge variant="secondary" className="hidden sm:inline-flex text-xs">
                {ROLE_LABELS[role]}
              </Badge>
              {/* Notifications */}
              <button className="relative rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Notifications">
                <Bell className="size-5" />
                <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-gold" />
              </button>
              {/* Avatar + name */}
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {initials}
                </span>
                <span className="hidden text-sm font-medium lg:block">{fullName?.split(" ")[0] || "User"}</span>
              </div>
            </div>
          </div>
          {/* Gold accent line */}
          <div className="h-0.5 bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom tab nav ─────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card shadow-[0_-2px_16px_rgba(0,0,0,0.07)] lg:hidden">
        <div className="mx-auto flex h-16 max-w-lg items-end justify-around px-2 pb-2 pt-1">
          {bottomTabs.map((tab) => {
            const active = isActive(tab.href, 0)
            const Icon = tab.icon
            return (
              <Link key={tab.href} href={tab.href}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition-all active:scale-95",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {active && <span className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-gold" />}
                <Icon className="size-5" />
                {tab.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
