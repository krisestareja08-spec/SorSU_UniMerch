import { cn } from "@/lib/utils"

/** Grey pulsing placeholder shown while data loads. */
export function Bone({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-muted", className)} />
}

/** Announces the loading state once for screen readers; the bones themselves are hidden. */
export function LoadingRegion({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-primary/10 bg-card">
      <Bone className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Bone className="h-3.5 w-4/5" />
        <Bone className="h-3 w-1/2" />
        <Bone className="h-4 w-1/3" />
        <Bone className="h-7 w-full" />
      </div>
    </div>
  )
}

export function ProductGridSkeleton({ count = 10, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5", className)}>
      {Array.from({ length: count }, (_, i) => <ProductCardSkeleton key={i} />)}
    </div>
  )
}

export function PageTitleSkeleton() {
  return (
    <div className="mb-4 space-y-2">
      <Bone className="h-7 w-48" />
      <Bone className="h-px w-full" />
    </div>
  )
}

export function ListRowsSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <Bone className="size-14 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2"><Bone className="h-4 w-1/2" /><Bone className="h-3 w-3/4" /></div>
          <Bone className="h-5 w-16" />
        </div>
      ))}
    </div>
  )
}
