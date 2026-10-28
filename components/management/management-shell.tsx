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
import { Menu, X, LogOut, ChevronsUpDown, Check, Crown, UserCog, ShoppingBag, ChevronRight, BadgeCheck } from "lucide-react"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { LiveAlerts } from "@/components/notifications/live-alerts"
import { HistoryButtons } from "@/components/navigation/history-nav"
import { badgeText, useBadges } from "@/components/navigation/use-badges"
import { getNavBadges } from "@/app/nav-badge-actions"
import {
  MODULES, MEMBERS_PAGE, canUse, dashboardHref, membersHref,
  type DashboardCtx, type ModuleKey, type ModulePage,
} from "@/lib/modules"

// Mobile bottom tabs: each dashboard's most-used pages, in order (the rest are in the menu).
// The Storefront of sellers and Supply Office branches is the raised, highlighted centre button.
const BOTTOM_TABS: Partial<Record<ModuleKey, string[]>> = {
  seller: ["/seller", "/seller/orders", "/seller/shop", "/seller/inventory", "/seller/analytics"],
  bao: ["/bao", "/bao/approvals", "/bao/browse", "/bao/royalty", "/bao/reports"],
  supply_office: ["/supply-office", "/supply-office/orders", "/supply-office/products", "/supply-office/inventory", "/supply-office/shop"],
  cashier: ["/cashier", "/cashier/orders", "/cashier/shop", "/cashier/products", "/cashier/inventory"],
}
const HIGHLIGHT_TABS = new Set(["/seller/shop", "/cashier/shop"])

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
    // Members who also shop reach the marketplace from "Shop as buyer" above the menu; everyone's
    // password lives on the shared My Account page.
    { label: "My Account", short: "Account", href: "/account", icon: UserCog },
  ]
  const canSwitch = ctx.dashboards.length > 1 || !!ctx.canShop
  const homeHref = moduleDef.basePath
  // A fixed set of tabs per dashboard (pages the member has no permission for are left out)
  const preferred = BOTTOM_TABS[ctx.module]
  const pickedTabs = preferred
    ? preferred.map((href) => nav.find((n) => n.href === href)).filter((n): n is (typeof nav)[number] => !!n)
    : []
  const bottomTabs = pickedTabs.length >= 2 ? pickedTabs : nav.slice(0, 5)
  const roleLabel = ctx.isMain ? "Main Admin" : "Member"

  // Number badges: what's new or waiting for review on each page (scripts/32 §3e)
  const badges = useBadges(`dash:${ctx.dashboardId}`, () => getNavBadges(ctx.dashboardId))
  const badgeOf = (href: string) => (href.startsWith(moduleDef.basePath + "/") ? badges[href.slice(moduleDef.basePath.length + 1)] ?? 0 : 0)
  // Something waiting on a page that's only in the menu (not a bottom tab): a dot on the menu button
  const hiddenWaiting = nav.some((n) => badgeOf(n.href) > 0 && !bottomTabs.some((t) => t.href === n.href))

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
          {canSwitch && <ChevronsUpDown className="size-4 shrink-0 text-primary-foreground/60" />}
        </button>
        {switcherOpen && canSwitch && (
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
            {ctx.canShop && (
              <Link href="/marketplace" className="flex items-center gap-2 border-t border-border px-3 py-2 text-sm hover:bg-muted">
                <ShoppingBag className="size-4 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Marketplace</span>
                  <span className="block text-[11px] text-muted-foreground">Shop as a buyer</span>
                </span>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Verified students / faculty / staff on a store dashboard also shop (lib/member-shopping.ts) */}
      {ctx.canShop ? (
        <Link href="/marketplace" onClick={() => setDrawerOpen(false)}
          className="group mx-3 mt-1 flex items-center gap-3 rounded-xl bg-gold px-3 py-2.5 text-primary shadow-sm transition-colors hover:bg-gold/90">
          <ShoppingBag className="size-5 shrink-0" />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-sm font-semibold">Shop as buyer</span>
            <span className="block text-[11px] text-primary/75">Open the marketplace</span>
          </span>
          <ChevronRight className="size-4 shrink-0 opacity-60 group-hover:opacity-100" />
        </Link>
      ) : ctx.verifyToShop ? (
        <Link href="/verify" onClick={() => setDrawerOpen(false)}
          className="group mx-3 mt-1 flex items-center gap-3 rounded-xl border border-primary-foreground/15 px-3 py-2.5 text-primary-foreground/85 transition-colors hover:bg-primary-foreground/8">
          <BadgeCheck className="size-5 shrink-0 text-gold/80" />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-sm font-medium">Get verified to shop</span>
            <span className="block text-[11px] text-primary-foreground/55">Verified students &amp; staff can also buy</span>
          </span>
          <ChevronRight className="size-4 shrink-0 opacity-60 group-hover:opacity-100" />
        </Link>
      ) : null}

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
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {badgeOf(item.href) > 0 && (
                <span className="ml-auto min-w-5 rounded-full bg-gold px-1.5 text-center text-[11px] font-bold leading-5 text-primary"
                  aria-label={`${badgeOf(item.href)} waiting`}>{badgeText(badgeOf(item.href))}</span>
              )}
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-primary/20 shadow-lg lg:block print:hidden">
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
      <div className="flex min-h-screen flex-col lg:pl-64 print:pl-0">
        {/* Top bar — desktop + mobile */}
        <header className="sticky top-0 z-20 border-b border-border bg-card/95 shadow-sm backdrop-blur print:hidden">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            {/* Hamburger — mobile only */}
            <button onClick={() => setDrawerOpen(true)}
              className="relative rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
              aria-label={hiddenWaiting ? "Open menu — items waiting" : "Open menu"}>
              <Menu className="size-5" />
              {hiddenWaiting && <span className="absolute right-1 top-1 size-2 rounded-full bg-destructive ring-2 ring-card" aria-hidden />}
            </button>

            {/* Back / Forward through the pages visited in this tab */}
            <HistoryButtons fallbackHref={homeHref} className="-ml-1" />

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
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 overflow-x-clip px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:py-8 focus:outline-none print:p-0">
          {children}
        </main>
      </div>
      <LiveAlerts />

      {/* ── Mobile bottom tab nav ─────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card shadow-[0_-2px_16px_rgba(0,0,0,0.07)] lg:hidden print:hidden">
        <div className="mx-auto flex h-16 max-w-lg items-end justify-around px-2 pb-2 pt-1">
          {bottomTabs.map((tab) => {
            const active = isActive(tab.href)
            const Icon = tab.icon
            return (
              <Link key={tab.href + tab.label} href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-all active:scale-95",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {active && <span className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-gold" />}
                {HIGHLIGHT_TABS.has(tab.href) ? (
                  <span className={cn(
                    "-mt-5 flex size-10 items-center justify-center rounded-2xl shadow-lg transition-all",
                    active ? "bg-primary" : "bg-primary/90",
                  )}>
                    <Icon className="size-5 text-primary-foreground" />
                  </span>
                ) : (
                  <span className="relative">
                    <Icon className="size-5" />
                    {badgeOf(tab.href) > 0 && (
                      <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-4 text-white ring-2 ring-card"
                        aria-label={`${badgeOf(tab.href)} waiting`}>{badgeText(badgeOf(tab.href))}</span>
                    )}
                  </span>
                )}
                <span className={cn("block max-w-full truncate px-0.5", HIGHLIGHT_TABS.has(tab.href) && "mt-1")}>{tab.short ?? tab.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
