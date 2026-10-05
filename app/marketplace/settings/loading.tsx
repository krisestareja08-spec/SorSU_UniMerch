import { Bone, LoadingRegion, PageTitleSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <LoadingRegion label="Loading settings" className="mx-auto max-w-2xl space-y-4 px-4 py-6 sm:px-6">
      <PageTitleSkeleton />
      {["h-72", "h-24", "h-36", "h-20"].map((h) => <Bone key={h} className={`w-full rounded-2xl ${h}`} />)}
    </LoadingRegion>
  )
}
