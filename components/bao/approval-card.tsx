"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import { CheckCircle2, XCircle, MessageCircle, Package, Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { approveProduct, rejectProduct, sendBaoMessage } from "@/app/bao/approvals/actions"

type Product = {
  id: string
  name: string
  description: string | null
  category: string
  price: number
  image_url: string | null
  stock: number
  status: string
  badge: string
  seller_id: string
  created_at: string
}

export function BaoApprovalCard({ product }: { product: Product }) {
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [comment, setComment] = useState("")
  const [chatMsg, setChatMsg] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleApprove() {
    startTransition(async () => {
      await approveProduct(product.id)
    })
  }

  function handleReject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set("product_id", product.id)
    startTransition(async () => {
      await rejectProduct(fd)
      setShowRejectForm(false)
    })
  }

  function handleSendMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!chatMsg.trim()) return
    const fd = new FormData()
    fd.set("product_id", product.id)
    fd.set("message", chatMsg.trim())
    startTransition(async () => {
      await sendBaoMessage(fd)
      setChatMsg("")
    })
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200 bg-card shadow-sm dark:border-amber-500/20">
      <div className="flex gap-4 p-4">
        {/* Image */}
        <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted sm:size-24">
          {product.image_url ? (
            <Image src={product.image_url} alt={product.name} fill className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Package className="size-8 text-muted-foreground/30" />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-1 flex-col gap-1 min-w-0">
          <p className="font-medium text-foreground">{product.name}</p>
          <p className="text-xs text-muted-foreground">{product.category} · ₱{Number(product.price).toLocaleString()} · Stock: {product.stock}</p>
          <p className="text-xs text-muted-foreground">Badge: {product.badge}</p>
          {product.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      {!showRejectForm ? (
        <div className="flex items-center gap-2 border-t border-border bg-muted/30 px-4 py-3">
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={isPending}
            className="flex-1 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowRejectForm(true)}
            disabled={isPending}
            className="flex-1 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <XCircle className="size-3.5" />
            Reject
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowChat((v) => !v)}
            className={cn("gap-1.5", showChat && "bg-primary/10 border-primary/30 text-primary")}
          >
            <MessageCircle className="size-3.5" />
            Chat
          </Button>
        </div>
      ) : (
        <form onSubmit={handleReject} className="border-t border-border bg-destructive/5 px-4 py-3">
          <p className="mb-2 text-xs font-semibold text-destructive">Provide a reason for rejection:</p>
          <input type="hidden" name="product_id" value={product.id} />
          <textarea
            name="comment"
            rows={2}
            placeholder="e.g. Image is unclear, price is missing..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded-lg border border-destructive/30 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/40 resize-none"
          />
          <div className="mt-2 flex gap-2">
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setShowRejectForm(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending} className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
              Confirm Reject
            </Button>
          </div>
        </form>
      )}

      {/* Inline chat with seller */}
      {showChat && (
        <div className="border-t border-border bg-muted/20 px-4 py-3">
          <p className="mb-2 text-xs font-semibold text-foreground">Message the seller about this product:</p>
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              value={chatMsg}
              onChange={(e) => setChatMsg(e.target.value)}
              placeholder="Type a note or question..."
              className="flex-1 text-sm"
            />
            <Button type="submit" size="sm" disabled={isPending || !chatMsg.trim()} className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90">
              <Send className="size-3.5" />
            </Button>
          </form>
          <p className="mt-1.5 text-[10px] text-muted-foreground">Messages are visible to both you and the seller in the Seller Chat page.</p>
        </div>
      )}
    </div>
  )
}
