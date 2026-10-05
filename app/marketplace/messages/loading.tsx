import { Bone, LoadingRegion, PageTitleSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <LoadingRegion label="Loading messages" className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
      <PageTitleSkeleton />
      <div className="flex h-[calc(100dvh-11rem)] min-h-112 overflow-hidden rounded-2xl border border-border bg-card lg:h-[calc(100dvh-9rem)]">
        <div className="w-full space-y-3 p-3 lg:w-80 lg:border-r lg:border-border">
          <Bone className="h-9 w-full" />
          {Array.from({ length: 5 }, (_, i) => <div key={i} className="flex gap-3"><Bone className="size-11" /><div className="flex-1 space-y-2"><Bone className="h-3 w-2/3" /><Bone className="h-3 w-full" /></div></div>)}
        </div>
        <div className="hidden flex-1 lg:block" />
      </div>
    </LoadingRegion>
  )
}
