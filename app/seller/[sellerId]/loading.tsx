import { Bone, LoadingRegion, ProductGridSkeleton } from "@/components/skeletons"

/** A store's public storefront while it loads (not the Seller Dashboard frame). */
export default function Loading() {
  return (
    <LoadingRegion label="Loading the store" className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <Bone className="h-4 w-36" />
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Bone className="h-32 w-full rounded-none sm:h-44" />
        <div className="flex items-end gap-4 p-5">
          <Bone className="-mt-14 size-20 rounded-2xl border-4 border-card sm:size-24" />
          <div className="space-y-2 pb-1"><Bone className="h-6 w-48" /><Bone className="h-3 w-64 max-w-full" /></div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <Bone className="h-64 rounded-2xl" />
        <ProductGridSkeleton count={8} />
      </div>
    </LoadingRegion>
  )
}
