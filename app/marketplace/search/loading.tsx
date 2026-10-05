import { Bone, LoadingRegion, PageTitleSkeleton, ProductGridSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <LoadingRegion label="Searching" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageTitleSkeleton />
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 lg:w-64">
          {Array.from({ length: 6 }, (_, i) => <Bone key={i} className="h-9 w-full" />)}
        </div>
        <ProductGridSkeleton count={8} className="flex-1 xl:grid-cols-4" />
      </div>
    </LoadingRegion>
  )
}
