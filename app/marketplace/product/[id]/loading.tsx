import { Bone, LoadingRegion } from "@/components/skeletons"

export default function Loading() {
  return (
    <LoadingRegion label="Loading product" className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <Bone className="mb-6 h-4 w-40" />
      <div className="grid gap-8 sm:grid-cols-2">
        <Bone className="aspect-square w-full rounded-2xl" />
        <div className="space-y-4">
          <Bone className="h-5 w-20 rounded-full" />
          <Bone className="h-8 w-4/5" />
          <Bone className="h-4 w-1/3" />
          <Bone className="h-9 w-32" />
          <Bone className="h-16 w-full" />
          <div className="flex gap-2"><Bone className="h-12 flex-1 rounded-xl" /><Bone className="h-12 flex-1 rounded-xl" /></div>
          <Bone className="h-10 w-full rounded-xl" />
        </div>
      </div>
    </LoadingRegion>
  )
}
