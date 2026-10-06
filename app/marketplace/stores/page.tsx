import Link from "next/link"
import { StoreDirectory } from "@/components/storefront/store-directory"
import { CAMPUS_LABELS, type Campus } from "@/lib/roles"
import { cn } from "@/lib/utils"

const CAMPUSES = Object.entries(CAMPUS_LABELS) as [Campus, string][]

export default async function StoresPage({ searchParams }: { searchParams: Promise<{ campus?: string }> }) {
  const { campus: param } = await searchParams
  const campus = param && param in CAMPUS_LABELS ? (param as Campus) : undefined

  const chip = (href: string, label: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
      )}
    >
      {label}
    </Link>
  )

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">Stores</h1>
        <p className="mt-1 text-sm text-muted-foreground">Visit campus organizations and offices selling on UniMerch.</p>
        <div className="mt-2 h-px bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />
      </div>

      <nav aria-label="Filter stores by campus" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {chip("/marketplace/stores", "All campuses", !campus)}
        {CAMPUSES.map(([value, label]) => chip(`/marketplace/stores?campus=${value}`, label, campus === value))}
      </nav>

      <StoreDirectory title={campus ? CAMPUS_LABELS[campus] : "All Stores"} campus={campus} />
    </div>
  )
}
