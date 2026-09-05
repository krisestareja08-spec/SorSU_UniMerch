"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRouter } from "next/navigation"
import {
  Home, LayoutGrid, PackageSearch, Store, Wallet, Settings,
  HelpCircle, X, ChevronRight, Tag, Boxes, BarChart2, Users,
  ShieldCheck, FileText, ClipboardList, CheckSquare, TrendingUp,
  CreditCard, MessageCircle, LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { UserRole } from "@/lib/roles"

type NavItem = { href: string; label: string; icon: React.ElementType }

function buildDrawerNav(role: UserRole): NavItem[] {
  const common: NavItem[] = [
    { href: "/marketplace",            label: "Marketplace",    icon: Home },
    { href: "/marketplace/categories", label: "Categories",     icon: LayoutGrid },
    { href: "/marketplace/settings",   label: "Settings",       icon: Settings },
    { href: "/marketplace/help",       label: "Help Centre",    icon: HelpCircle },
  ]

  const roleItems: Record<UserRole, NavItem[]> = {
    buyer: [
      { href: "/marketplace/orders",  label: "My Orders",   icon: PackageSearch },
      { href: "/marketplace/account", label: "My Account",  icon: Users },
      { href: "/marketplace/wallet",  label: "Wallet",      icon: Wallet },
    ],
    seller: [
      { href: "/seller",              label: "Seller Dashboard", icon: LayoutGrid },
      { href: "/seller/products",     label: "My Products",      icon: Tag },
      { href: "/seller/orders",       label: "Orders",           icon: PackageSearch },
      { href: "/seller/inventory",    label: "Inventory",        icon: Boxes },
      { href: "/seller/analytics",    label: "Analytics",        icon: BarChart2 },
      { href: "/seller/chat",         label: "Messages",         icon: MessageCircle },
    ],
    bao: [
      { href: "/bao",                 label: "BAO Dashboard",    icon: LayoutGrid },
      { href: "/bao/sellers",         label: "Sellers",          icon: Users },
      { href: "/bao/approvals",       label: "Product Approvals",icon: CheckSquare },
      { href: "/bao/analytics",       label: "Analytics",        icon: BarChart2 },
      { href: "/bao/reports",         label: "Reports",          icon: FileText },
      { href: "/bao/logs",            label: "Logs",             icon: ClipboardList },
    ],
    admin: [
      { href: "/bao",                 label: "BAO Dashboard",    icon: LayoutGrid },
      { href: "/bao/sellers",         label: "Sellers",          icon: Users },
      { href: "/bao/approvals",       label: "Product Approvals",icon: CheckSquare },
      { href: "/bao/analytics",       label: "Analytics",        icon: BarChart2 },
    ],
    supply_office: [
      { href: "/supply-office",            label: "Supply Dashboard",icon: LayoutGrid },
      { href: "/supply-office/inventory",  label: "Inventory",       icon: Boxes },
      { href: "/supply-office/movement",   label: "Stock Movement",  icon: TrendingUp },
      { href: "/supply-office/restricted", label: "Restricted Items",icon: ShieldCheck },
    ],
    registrar: [
      { href: "/registrar",                label: "Registrar Home",  icon: LayoutGrid },
      { href: "/registrar/verification",   label: "Verify Queue",    icon: ShieldCheck },
      { href: "/registrar/reports",        label: "Reports",         icon: FileText },
    ],
  }

  return [...(roleItems[role] ?? []), ...common]
}

export function BurgerDrawer({
  open,
  onClose,
  role = "buyer",
}: {
  open: boolean
  onClose: () => void
  role?: UserRole
}) {
  const pathname = usePathname()
  const router = useRouter()
  const nav = buildDrawerNav(role)

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
