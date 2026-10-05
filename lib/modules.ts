import {
  LayoutDashboard, ShieldCheck, Users, AlertOctagon, Store, ClipboardList, Building2,
  CheckSquare, BarChart2, FileText, Settings, Boxes, ShoppingCart, Package,
  Tag, CreditCard, MessageCircle, MessagesSquare, Megaphone, Wallet, Globe, UserCog, Flag, Coins, type LucideIcon,
} from "lucide-react"

/**
 * Dashboards are management MODULES, not users. Users are assigned to a dashboard as its
 * Main Admin (full control, manages members) or as a member limited to the pages ticked
 * by the Main Admin. Each page below has a permission key; `null` = dashboard home (any member).
 */
export type ModuleKey = "verification" | "bao" | "supply_office" | "cashier" | "seller"

export type ModulePage = { perm: string | null; label: string; href: string; icon: LucideIcon }

export type ModuleDef = {
  key: ModuleKey
  name: string
  basePath: string
  pages: ModulePage[]
}

export const MODULES: Record<ModuleKey, ModuleDef> = {
  verification: {
    key: "verification",
    name: "Verification Admin",
    basePath: "/admin",
    pages: [
      { perm: null,            label: "Dashboard",           href: "/admin",            icon: LayoutDashboard },
      { perm: "queue",         label: "Verification Queue",  href: "/admin/queue",      icon: ShieldCheck },
      { perm: "users",         label: "User Management",     href: "/admin/users",      icon: Users },
      { perm: "duplicates",    label: "Duplicate Detection", href: "/admin/duplicates", icon: AlertOctagon },
      { perm: "reports",       label: "Reported Accounts",   href: "/admin/reports",    icon: Flag },
      { perm: "organizations", label: "Seller Management",   href: "/admin/sellers",    icon: Store },
      { perm: "cashiers",      label: "Cashier Branches",    href: "/admin/cashiers",   icon: Wallet },
      { perm: "logs",          label: "Activity Logs",       href: "/admin/logs",       icon: ClipboardList },
      { perm: "dashboards",    label: "Dashboard Admins",    href: "/admin/dashboards", icon: Building2 },
    ],
  },
  bao: {
    key: "bao",
    name: "BAO",
    basePath: "/bao",
    pages: [
      { perm: null,          label: "Dashboard",          href: "/bao",             icon: LayoutDashboard },
      { perm: "analytics",   label: "BI Analytics",       href: "/bao/analytics",   icon: BarChart2 },
      { perm: "royalty",     label: "Royalty Earnings",   href: "/bao/royalty",     icon: Coins },
      { perm: "sellers",     label: "Seller Monitoring",  href: "/bao/sellers",     icon: Store },
      { perm: "marketplace", label: "Marketplace",        href: "/bao/browse",      icon: Store },
      { perm: "marketplace", label: "Product Monitor",    href: "/bao/marketplace", icon: Globe },
      { perm: "approvals",   label: "Product Approvals",  href: "/bao/approvals",   icon: CheckSquare },
      { perm: "reports",     label: "Sales Reports",      href: "/bao/reports",     icon: FileText },
      { perm: "logs",        label: "Operational Logs",   href: "/bao/logs",        icon: ClipboardList },
      { perm: "settings",    label: "Royalty Settings",   href: "/bao/settings",    icon: Settings },
    ],
  },
  supply_office: {
    key: "supply_office",
    name: "Supply Office",
    basePath: "/supply-office",
    pages: [
      { perm: null,         label: "Dashboard",        href: "/supply-office",            icon: LayoutDashboard },
      { perm: "storefront", label: "Storefront",       href: "/supply-office/shop",       icon: Store },
      { perm: "storefront", label: "Banners",          href: "/supply-office/banners",    icon: Megaphone },
      { perm: "orders",     label: "Orders",           href: "/supply-office/orders",     icon: ShoppingCart },
      { perm: "messages",   label: "Buyer Messages",   href: "/supply-office/messages",   icon: MessageCircle },
      { perm: "products",   label: "Products",         href: "/supply-office/products",   icon: Package },
      { perm: "inventory",  label: "Inventory",        href: "/supply-office/inventory",  icon: Boxes },
      { perm: "restricted", label: "Restricted Items", href: "/supply-office/restricted", icon: ShieldCheck },
      { perm: "reports",    label: "Sales Reports",    href: "/supply-office/reports",    icon: FileText },
      { perm: "settings",   label: "Settings",         href: "/supply-office/settings",   icon: Settings },
    ],
  },
  cashier: {
    key: "cashier",
    name: "Cashier",
    basePath: "/cashier",
    pages: [
      { perm: null,         label: "Dashboard",           href: "/cashier",            icon: LayoutDashboard },
      { perm: "storefront", label: "Storefront",          href: "/cashier/shop",       icon: Store },
      { perm: "storefront", label: "Banners",             href: "/cashier/banners",    icon: Megaphone },
      { perm: "orders",     label: "Orders",              href: "/cashier/orders",     icon: ShoppingCart },
      { perm: "messages",   label: "Buyer Messages",      href: "/cashier/messages",   icon: MessageCircle },
      { perm: "products",   label: "Products",            href: "/cashier/products",   icon: Package },
      { perm: "inventory",  label: "Inventory",           href: "/cashier/inventory",  icon: Boxes },
      { perm: "restricted", label: "Restricted Items",    href: "/cashier/restricted", icon: ShieldCheck },
      { perm: "payments",   label: "Transaction History", href: "/cashier/payments",   icon: CreditCard },
      { perm: "reports",    label: "Sales Reports",       href: "/cashier/reports",    icon: FileText },
      { perm: "settings",   label: "Settings",            href: "/cashier/settings",   icon: Settings },
    ],
  },
  seller: {
    key: "seller",
    name: "Seller Dashboard",
    basePath: "/seller",
    pages: [
      { perm: null,         label: "Dashboard",   href: "/seller",           icon: LayoutDashboard },
      { perm: "storefront", label: "Storefront",  href: "/seller/shop",      icon: Store },
      { perm: "storefront", label: "Banners",     href: "/seller/banners",   icon: Megaphone },
      { perm: "products",   label: "Products",    href: "/seller/products",  icon: Tag },
      { perm: "orders",     label: "Orders",      href: "/seller/orders",    icon: ShoppingCart },
      { perm: "inventory",  label: "Inventory",   href: "/seller/inventory", icon: Boxes },
      { perm: "analytics",  label: "Analytics",   href: "/seller/analytics", icon: BarChart2 },
      { perm: "reports",    label: "Sales Reports", href: "/seller/reports", icon: FileText },
      { perm: "payments",   label: "Payments",    href: "/seller/payments",  icon: CreditCard },
      { perm: "messages",   label: "Buyer Messages", href: "/seller/messages", icon: MessageCircle },
      { perm: "messages",   label: "BAO Messages", href: "/seller/chat",      icon: MessagesSquare },
      { perm: "settings",   label: "Settings",    href: "/seller/settings",  icon: Settings },
    ],
  },
}

export const MEMBERS_PAGE = { label: "Members", icon: UserCog }

/** Pages a Main Admin can grant to members (everything except the home page). */
export function grantablePages(module: ModuleKey) {
  // Pages sharing a permission become one checkbox ("Buyer Messages / BAO Messages")
  const byPerm = new Map<string, ModulePage & { perm: string }>()
  for (const p of MODULES[module].pages) {
    if (p.perm === null) continue
    const seen = byPerm.get(p.perm)
    byPerm.set(p.perm, seen ? { ...seen, label: `${seen.label} / ${p.label}` } : { ...p, perm: p.perm })
  }
  return [...byPerm.values()]
}

export function membersHref(module: ModuleKey) {
  return `${MODULES[module].basePath}/members`
}

/** Serializable dashboard context handed from server pages to the (client) ManagementShell. */
export type DashboardSummary = {
  id: string
  module: ModuleKey
  name: string
  storeId: string | null
  isMain: boolean
}

export type DashboardCtx = {
  userId: string
  email: string
  fullName: string | null
  module: ModuleKey
  dashboardId: string
  dashboardName: string
  storeId: string | null
  isMain: boolean
  permissions: string[]
  dashboards: DashboardSummary[]
}

export function canUse(ctx: Pick<DashboardCtx, "isMain" | "permissions">, perm: string | null) {
  return ctx.isMain || perm === null || ctx.permissions.includes(perm)
}

/** Modules with many dashboards (one per organization / cashier branch). */
export const MULTI_INSTANCE: ModuleKey[] = ["seller", "cashier"]

export function dashboardHref(d: DashboardSummary) {
  return MULTI_INSTANCE.includes(d.module) ? `/dashboards/switch?id=${d.id}` : MODULES[d.module].basePath
}
