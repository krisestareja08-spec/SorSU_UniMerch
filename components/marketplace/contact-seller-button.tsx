"use client"

import { useState } from "react"
import { MessageCircle, X, Wallet } from "lucide-react"

export function ContactSellerButton({ gcashNumber }: { gcashNumber: string | null }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-1.5 text-sm font-semibold text-foreground hover:border-primary/40 hover:bg-primary/5"
      >
        {open ? <X className="size-3.5" /> : <MessageCircle className="size-3.5" />}
        Contact Seller
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 w-56 rounded-xl border border-border bg-card p-3 text-sm shadow-lg">
          {gcashNumber ? (
            <p className="flex items-center gap-2 text-foreground">
              <Wallet className="size-3.5 shrink-0 text-primary" /> GCash: {gcashNumber}
            </p>
          ) : (
            <p className="text-muted-foreground">This seller hasn&apos;t shared contact details yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
