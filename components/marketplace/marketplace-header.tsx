"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { Search, ShoppingCart, Menu, LayoutDashboard, BadgeCheck } from "lucide-react"
import { BurgerDrawer } from "./burger-drawer"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { MessagesLink } from "@/components/messages/messages-link"
import { ThemeToggle } from "@/components/theme-select"
import { AFFILIATION_LABELS, type Affiliation } from "@/lib/roles"
import { dashboardHref, type DashboardSummary } from "@/lib/modules"
import { useCart } from "@/lib/cart-context"

export function MarketplaceHeader({
  dashboards = [],
  fullName,
  isVerified = false,
  affiliation,
}: {
  dashboards?: DashboardSummary[]
  fullName?: string | null
  isVerified?: boolean
  affiliation?: string | null
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [query, setQuery] = useState("")
  const { itemCount } = useCart()

  const hasDashboards = dashboards.length > 0
  const dashHref = dashboards.length === 1 ? dashboardHref(dashboards[0]) : "/dashboard"
  const initials = (fullName || "U").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()

  return (
    <>
      <header className="sticky top-0 z-40 bg-primary shadow-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:h-16 sm:px-6">
          {/* Hamburger — mobile */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="shrink-0 rounded-lg p-1.5 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 active:scale-95 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>

          {/* Logo */}
          <Link href="/marketplace" className="flex shrink-0 items-center gap-2">
            <Image src="/sorsu-seal.png" alt="SorSU seal" width={32} height={32}
              className="rounded-full ring-1 ring-primary-foreground/30" />
            <span className="hidden font-serif text-sm font-semibold text-primary-foreground sm:inline lg:text-base">
              Uni<span className="text-gold">Merch</span>
            </span>
          </Link>

          {/* Search bar — products and stores */}
          <form action="/marketplace/search" role="search" className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search campus goods, orgs, merch…"
              aria-label="Search products and stores"
              className="h-9 w-full rounded-full border border-transparent bg-background pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
          </form>

          {/* Right icons */}
          <div className="flex shrink-0 items-center gap-1">

            {/* Dark mode — on phones it lives in the menu drawer */}
            <ThemeToggle tone="dark" className="hidden sm:block" />

            {/* Notifications */}
            <NotificationBell tone="dark" />

            {/* Messages */}
            <MessagesLink />

            {/* Cart */}
            <Link href="/marketplace/cart" className="relative rounded-lg p-2 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 active:scale-95" aria-label="Cart">
              <ShoppingCart className="size-5" />
              {itemCount > 0 && (
                <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-primary">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </Link>

            {/* Dashboard shortcut — only for users assigned to a management dashboard */}
            {hasDashboards && (
              <Link href={dashHref} className="hidden rounded-lg p-2 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 active:scale-95 sm:block" aria-label="My Dashboard">
                <LayoutDashboard className="size-5" />
              </Link>
            )}

            {/* Avatar */}
            <Link
              href="/marketplace/account"
              className="relative ml-1 flex size-8 items-center justify-center rounded-full bg-gold text-xs font-bold text-primary"
              title={isVerified ? `Verified ${AFFILIATION_LABELS[affiliation as Affiliation] ?? ""}`.trim() : "Guest — not verified"}
            >
              {initials}
              {isVerified && (
                <BadgeCheck className="absolute -bottom-1 -right-1 size-4 rounded-full bg-primary fill-emerald-500 text-primary" aria-label="Verified" />
              )}
            </Link>
          </div>
        </div>
        <div className="h-0.5 w-full bg-gold/70" />
      </header>

      <BurgerDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} dashboards={dashboards} />
    </>
  )
}
