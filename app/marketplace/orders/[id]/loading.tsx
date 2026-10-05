import { Bone, LoadingRegion } from "@/components/skeletons"

export default function Loading() {
  return (
    <LoadingRegion label="Loading order details" className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Bone className="mb-4 h-4 w-24" />
      <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3"><Bone className="size-10 rounded-xl" /><div className="flex-1 space-y-2"><Bone className="h-4 w-40" /><Bone className="h-3 w-56" /></div></div>
        <div className="flex justify-between gap-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="flex flex-1 flex-col items-center gap-2"><Bone className="size-8 rounded-full" /><Bone className="h-3 w-14" /></div>)}</div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <Bone className="h-72 rounded-2xl" />
        <div className="space-y-4"><Bone className="h-28 rounded-2xl" /><Bone className="h-48 rounded-2xl" /></div>
      </div>
    </LoadingRegion>
  )
}
