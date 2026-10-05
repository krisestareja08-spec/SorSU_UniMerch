import { Bone, LoadingRegion, PageTitleSkeleton, ProductGridSkeleton } from "@/components/skeletons"

/** Homepage (and fallback for any marketplace page without its own loading screen) */
export default function Loading() {
  return (
    <LoadingRegion label="Loading the marketplace" className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6">
      <Bone className="h-40 w-full rounded-2xl sm:h-52" />
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="flex flex-col items-center gap-2"><Bone className="size-12 rounded-2xl" /><Bone className="h-3 w-12" /></div>)}
      </div>
      <div>
        <PageTitleSkeleton />
        <ProductGridSkeleton />
      </div>
    </LoadingRegion>
  )
}
