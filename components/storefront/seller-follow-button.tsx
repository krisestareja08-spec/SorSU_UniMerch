"use client"

import { useState, useTransition } from "react"
import { Heart, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toggleFollowSeller } from "@/app/seller/[sellerId]/actions"

export function SellerFollowButton({ sellerId, initiallyFollowing }: { sellerId: string; initiallyFollowing: boolean }) {
  const [following, setFollowing] = useState(initiallyFollowing)
  const [pending, startTransition] = useTransition()

  function handleClick() {
    setFollowing((f) => !f)
    startTransition(async () => {
      try {
        await toggleFollowSeller(sellerId)
      } catch {
        setFollowing((f) => !f)
      }
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-sm font-semibold transition-colors",
        following
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5",
      )}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Heart className={cn("size-3.5", following && "fill-current")} />}
      {following ? "Following" : "Follow Seller"}
    </button>
  )
}
