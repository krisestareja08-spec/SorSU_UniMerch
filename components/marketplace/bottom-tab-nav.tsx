"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, LayoutGrid, PlusSquare, PackageSearch, User } from "lucide-react"
import { cn } from "@/lib/utils"

const TABS = [
  { href: "/marketplace",            label: "Home",       icon: Home },
  { href: "/marketplace/categories", label: "Categories", icon: LayoutGrid },
  { href: "/seller",                 label: "Sell",       icon: PlusSquare, highlight: true },
  { href: "/marketplace/orders",     label: "Orders",     icon: PackageSearch },
  { href: "/marketplace/account",    label: "Account",    icon: User },
]

export function BottomTabNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card shadow-[0_-2px_16px_rgba(0,0,0,0.07)] lg:hidden">
      <div className="mx-auto flex h-16 max-w-lg items-end justify-around px-2 pb-2 pt-1">
        {TABS.map(({ href, label, icon: Icon, highlight }) => {
          const active = pathname === href || (href !== "/marketplace" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition-all active:scale-95",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {/* Gold underline indicator for active tab */}
              {active && (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-gold" />
              )}

              {/* Sell button gets a special floating style */}
              {highlight ? (
                <span className={cn(
                  "flex size-10 -mt-5 items-center justify-center rounded-2xl shadow-lg transition-transform active:scale-95",
                  active ? "bg-primary" : "bg-primary/90 hover:bg-primary",
                )}>
                  <Icon className="size-5 text-primary-foreground" />
                </span>
              ) : (
                <Icon className={cn("size-5", active && "text-primary")} />
              )}

              <span className={cn(highlight && "mt-1")}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
