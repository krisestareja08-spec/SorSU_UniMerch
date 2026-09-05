"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { Search, Bell, MessageCircle, ShoppingCart, Menu, LayoutDashboard } from "lucide-react"
import { BurgerDrawer } from "./burger-drawer"
import { roleDashboard, type UserRole } from "@/lib/roles"
import { useCart } from "@/lib/cart-context"

const ROLE_BADGES: Record<UserRole, { label: string; color: string }> = {
  buyer:         { label: "Buyer",          color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  seller:        { label: "Seller",         color: "bg-gold/20 text-amber-700 dark:text-gold" },
  bao:           { label: "BAO Admin",      color: "bg-primary/15 text-primary" },
  admin:         { label: "BAO Admin",      color: "bg-primary/15 text-primary" },
  supply_office: { label: "Supply Office",  color: "bg-primary/10 text-primary" },
  registrar:     { label: "Registrar",      color: "bg-primary/10 text-primary" },
}

export function MarketplaceHeader({
  role = "buyer",
  fullName,
}: {
  role?: UserRole
  fullName?: string | null
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [query, setQuery] = useState("")
  const { itemCount } = useCart()

  const isBuyer = role === "buyer"
  const isStaff = !isBuyer
  const badge = ROLE_BADGES[role] ?? ROLE_BADGES.buyer
  const dashHref = roleDashboard(role)
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

          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search campus goods, orgs, merch…"
              className="h-9 w-full rounded-full border border-transparent bg-background pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>

          {/* Right icons */}
          <div className="flex shrink-0 items-center gap-1">
            {/* Role badge — desktop only */}
            <span className={`hidden rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline ${badge.color}`}>
              {badge.label}
            </span>

            {/* Notifications */}
            <button className="relative rounded-lg p-2 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 active:scale-95" aria-label="Notifications">
              <Bell className="size-5" />
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-gold" />
            </button>

            {/* Messages — buyer + seller only */}
            {(isBuyer || role === "seller") && (
              <Link href="/marketplace/messages" className="hidden rounded-lg p-2 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 active:scale-95 sm:block" aria-label="Messages">
                <MessageCircle className="size-5" />
              </Link>
            )}

            {/* Cart — buyer only */}
            {isBuyer && (
              <Link href="/marketplace/cart" className="relative rounded-lg p-2 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 active:scale-95" aria-label="Cart">
                <ShoppingCart className="size-5" />
                {itemCount > 0 && (
                  <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-primary">
                    {itemCount > 99 ? "99+" : itemCount}
                  </span>
                )}
              </Link>
            )}

            {/* Dashboard shortcut — staff roles */}
            {isStaff && (
              <Link href={dashHref} className="hidden rounded-lg p-2 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 active:scale-95 sm:block" aria-label="My Dashboard">
                <LayoutDashboard className="size-5" />
              </Link>
            )}

            {/* Avatar */}
            <span className="flex size-8 items-center justify-center rounded-full bg-gold text-xs font-bold text-primary ml-1">
              {initials}
            </span>
          </div>
        </div>
        <div className="h-0.5 w-full bg-gold/70" />
      </header>

      <BurgerDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} role={role} />
    </>
  )
}
