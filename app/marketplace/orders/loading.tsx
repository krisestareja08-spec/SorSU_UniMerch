import { Bone, ListRowsSkeleton, LoadingRegion, PageTitleSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <LoadingRegion label="Loading your orders" className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <PageTitleSkeleton />
      <Bone className="h-10 w-full rounded-xl" />
      <ListRowsSkeleton className="mt-5" />
    </LoadingRegion>
  )
}
