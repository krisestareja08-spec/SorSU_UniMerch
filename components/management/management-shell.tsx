"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { resetTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Menu, X, LogOut, ChevronsUpDown, Check, Crown, UserCog } from "lucide-react"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { LiveAlerts } from "@/components/notifications/live-alerts"
import {
  MODULES, MEMBERS_PAGE, canUse, dashboardHref, membersHref,
  type DashboardCtx, type ModulePage,
} from "@/lib/modules"

// Seller bottom tabs, in order; Storefront is the raised, highlighted button. Other pages are in the menu.
const SELLER_TABS = ["/seller", "/seller/orders", "/seller/shop", "/seller/inventory", "/seller/analytics"]
const HIGHLIGHT_TAB = "/seller/shop"

export function ManagementShell({
  ctx,
  children,
}: {
  ctx: DashboardCtx
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)

  const moduleDef = MODULES[ctx.module]
  const fullName = ctx.fullName
  const email = ctx.email
  const nav: Pick<ModulePage, "label" | "short" | "href" | "icon">[] = [
    ...moduleDef.pages.filter((p) => canUse(ctx, p.perm)),
    ...(ctx.isMain ? [{ label: MEMBERS_PAGE.label, href: membersHref(ctx.module), icon: MEMBERS_PAGE.icon }] : []),
    // Dashboard accounts never shop, so there is no marketplace link (lib/supabase/proxy.ts keeps them
    // out of the buyer pages). Their password lives on the shared My Account page.
    { label: "My Account", short: "Account", href: "/account", icon: UserCog },
  ]
  const homeHref = moduleDef.basePath
  // Sellers: a fixed set of tabs (pages the member has no permission for are left out)
  const sellerTabs = ctx.module === "seller"
    ? SELLER_TABS.map((href) => nav.find((n) => n.href === href)).filter((n): n is (typeof nav)[number] => !!n)
    : null
  const bottomTabs = sellerTabs ?? nav.slice(0, 5)
  const roleLabel = ctx.isMain ? "Main Admin" : "Member"

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    resetTheme()
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

  function isActive(href: string) {
    if (href === moduleDef.basePath) return pathname === href
    return pathname === href || pathname.startsWith(href + "/")
  }

  // ─── Sidebar inner content (shared desktop + drawer) ────────────────────────
  const SidebarContent = (
    <div className="flex h-full flex-col bg-primary text-primary-foreground">
      {/* Dashboard (module) + switcher across every dashboard this user manages */}
      <div className="relative px-3 pb-1 pt-4">
        <button
          type="button"
          onClick={() => setSwitcherOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-primary-foreground/8"
          aria-expanded={switcherOpen}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-primary-foreground/50">{moduleDef.name}</p>
            <p className="truncate text-sm font-semibold text-primary-foreground">{ctx.dashboardName}</p>
          </div>
          {ctx.dashboards.length > 1 && <ChevronsUpDown className="size-4 shrink-0 text-primary-foreground/60" />}
        </button>
        {switcherOpen && ctx.dashboards.length > 1 && (
          <div className="absolute inset-x-3 top-full z-10 mt-1 overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-xl">
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">My dashboards</p>
            {ctx.dashboards.map((d) => (
              <a key={d.id} href={dashboardHref(d)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{d.name}</span>
                  <span className="block text-[11px] text-muted-foreground">{MODULES[d.module].name}{d.isMain ? " · Main Admin" : ""}</span>
                </span>
                {d.id === ctx.dashboardId && <Check className="size-4 text-primary" />}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto py-3 px-2">
        {nav.map((item) => {
          const active = isActive(item.href)
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
          <p className="flex items-center gap-1 truncate text-xs text-primary-foreground/60">
            {ctx.isMain && <Crown className="size-3 text-gold" />}{roleLabel}
          </p>
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
            <Link href={homeHref} className="flex shrink-0 items-center gap-2">
              <Image src="/sorsu-seal.png" alt="SorSU seal" width={28} height={28} className="rounded-full ring-1 ring-border" />
              <span className="font-serif text-sm font-semibold">
                Uni<span className="text-gold">Merch</span>
              </span>
            </Link>

            <div className="ml-auto flex items-center gap-2">
              {/* Dashboard + membership level */}
              <Badge variant="secondary" className="hidden sm:inline-flex text-xs">
                {ctx.dashboardName} · {roleLabel}
              </Badge>
              {/* Notifications */}
              <NotificationBell showAll={false} />
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
        <main id="main-content" tabIndex={-1} className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 pb-24 lg:pb-8 focus:outline-none">
          {children}
        </main>
      </div>
      <LiveAlerts />

      {/* ── Mobile bottom tab nav ─────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card shadow-[0_-2px_16px_rgba(0,0,0,0.07)] lg:hidden">
        <div className="mx-auto flex h-16 max-w-lg items-end justify-around px-2 pb-2 pt-1">
          {bottomTabs.map((tab) => {
            const active = isActive(tab.href)
            const Icon = tab.icon
            return (
              <Link key={tab.href + tab.label} href={tab.href}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition-all active:scale-95",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {active && <span className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-gold" />}
                {sellerTabs && tab.href === HIGHLIGHT_TAB ? (
                  <span className={cn(
                    "-mt-5 flex size-10 items-center justify-center rounded-2xl shadow-lg transition-all",
                    active ? "bg-primary" : "bg-primary/90",
                  )}>
                    <Icon className="size-5 text-primary-foreground" />
                  </span>
                ) : (
                  <Icon className="size-5" />
                )}
                <span className={cn("whitespace-nowrap", sellerTabs && tab.href === HIGHLIGHT_TAB && "mt-1")}>{tab.short ?? tab.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
