"use client"

import { useFormStatus } from "react-dom"
import { Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { deleteUser } from "@/app/admin/verification-actions"

function SubmitButton({ compact }: { compact?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} title="Delete user"
      className={cn(
        "inline-flex items-center gap-1 rounded-lg text-xs font-semibold disabled:opacity-60",
        compact
          ? "p-1.5 text-destructive hover:bg-destructive/10"
          : "h-8 bg-destructive px-3 text-destructive-foreground hover:bg-destructive/90",
      )}>
      <Trash2 className="size-3.5" />
      {compact ? <span className="sr-only">Delete user</span> : pending ? "Deleting…" : "Delete user"}
    </button>
  )
}

/** Permanently deletes a user and their data, after a confirmation prompt. */
export function DeleteUserButton({ userId, name, compact, withReason }: {
  userId: string
  name: string
  compact?: boolean
  withReason?: boolean
}) {
  return (
    <form action={deleteUser} className={cn(withReason && "flex flex-wrap items-center gap-2")}
      onSubmit={(e) => {
        if (!window.confirm(`Permanently delete ${name}?\n\nTheir login, profile, orders, cart, wishlist, messages, verification requests and dashboard memberships will be erased. This cannot be undone.`)) {
          e.preventDefault()
        }
      }}>
      <input type="hidden" name="user_id" value={userId} />
      {withReason && (
        <input name="reason" placeholder="Reason for deletion"
          className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs sm:w-auto sm:flex-1" />
      )}
      <SubmitButton compact={compact} />
    </form>
  )
}
