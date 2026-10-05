import { Bone, ListRowsSkeleton, LoadingRegion, PageTitleSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <LoadingRegion label="Loading notifications" className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <PageTitleSkeleton />
      <Bone className="h-10 w-80 max-w-full rounded-xl" />
      <ListRowsSkeleton className="mt-4" rows={5} />
    </LoadingRegion>
  )
}
