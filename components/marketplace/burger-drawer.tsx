"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRouter } from "next/navigation"
import {
  Home, LayoutGrid, PackageSearch, Settings, HelpCircle, X, ChevronRight, Users, ShieldCheck, LogOut, Building2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { MODULES, dashboardHref, type DashboardSummary } from "@/lib/modules"

type NavItem = { href: string; label: string; icon: React.ElementType }

const USER_NAV: NavItem[] = [
  { href: "/marketplace",            label: "Marketplace",  icon: Home },
  { href: "/marketplace/categories", label: "Categories",   icon: LayoutGrid },
  { href: "/marketplace/orders",     label: "My Orders",    icon: PackageSearch },
  { href: "/marketplace/account",    label: "My Account",   icon: Users },
  { href: "/verify",                 label: "Verification", icon: ShieldCheck },
  { href: "/marketplace/settings",   label: "Settings",     icon: Settings },
  { href: "/marketplace/help",       label: "Help Centre",  icon: HelpCircle },
]

export function BurgerDrawer({
  open,
  onClose,
  dashboards = [],
}: {
  open: boolean
  onClose: () => void
  dashboards?: DashboardSummary[]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const nav = USER_NAV

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <>
      <div onClick={onClose}
        className={cn("fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0")}
        aria-hidden />

      <div className={cn("fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-primary shadow-2xl transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full")}
        role="dialog" aria-modal aria-label="Navigation menu">

        <div className="flex items-center justify-between border-b border-primary-foreground/10 px-5 py-4">
          <Link href="/marketplace" onClick={onClose} className="flex items-center gap-2.5">
            <Image src="/sorsu-seal.png" alt="SorSU seal" width={36} height={36}
              className="rounded-full ring-1 ring-gold/60" />
            <div className="leading-tight">
              <p className="font-serif text-sm font-semibold text-primary-foreground">
                Uni<span className="text-gold">Merch</span>
              </p>
              <p className="text-[10px] text-primary-foreground/60">Sorsogon State University</p>
            </div>
          </Link>
          <button onClick={onClose}
            className="rounded-lg p-1.5 text-primary-foreground/60 transition-colors hover:bg-primary-foreground/10"
            aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>
        <div className="h-0.5 bg-gradient-to-r from-gold/80 via-gold/40 to-transparent" />

        <nav className="flex-1 overflow-y-auto py-3">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link key={href + label} href={href} onClick={onClose}
                className={cn("group flex items-center gap-3 px-5 py-3 text-sm transition-colors",
                  active ? "bg-primary-foreground/10 text-gold" : "text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground")}>
                <Icon className={cn("size-5 shrink-0", active ? "text-gold" : "text-gold/60 group-hover:text-gold/80")} />
                <span className="flex-1 font-medium">{label}</span>
                <ChevronRight className="size-4 opacity-30 group-hover:opacity-60" />
              </Link>
            )
          })}
          {dashboards.length > 0 && (
            <>
              <p className="px-5 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/45">My dashboards</p>
              {dashboards.map((d) => (
                <a key={d.id} href={dashboardHref(d)} onClick={onClose}
                  className="group flex items-center gap-3 px-5 py-3 text-sm text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground">
                  <Building2 className="size-5 shrink-0 text-gold/60 group-hover:text-gold/80" />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate font-medium">{d.name}</span>
                    <span className="block text-[11px] text-primary-foreground/50">{MODULES[d.module].name}{d.isMain ? " · Main Admin" : ""}</span>
                  </span>
                  <ChevronRight className="size-4 opacity-30 group-hover:opacity-60" />
                </a>
              ))}
            </>
          )}
        </nav>

        <div className="border-t border-primary-foreground/10 px-5 py-4 flex items-center justify-between">
          <p className="text-xs text-primary-foreground/40">UniMerch v1.0 · Bulan Campus</p>
          <button onClick={signOut}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-primary-foreground/60 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </div>
    </>
  )
}
