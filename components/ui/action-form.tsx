"use client"

import { useActionState } from "react"
import { AlertCircle } from "lucide-react"
import type { ActionResult } from "@/lib/action-result"
import { cn } from "@/lib/utils"

/**
 * A <form> for a server action that returns ActionResult (lib/action-result.ts): submits the same
 * way as <form action={…}>, and shows the action's error message under the form if it fails.
 */
export function ActionForm({
  action,
  className,
  onSubmit,
  children,
}: {
  action: (formData: FormData) => Promise<ActionResult<unknown>>
  className?: string
  onSubmit?: React.FormEventHandler<HTMLFormElement>
  children: React.ReactNode
}) {
  const [state, formAction] = useActionState(
    async (_prev: ActionResult<unknown> | null, formData: FormData) => action(formData),
    null,
  )
  return (
    <form action={formAction} onSubmit={onSubmit} className={className}>
      {children}
      {state && !state.ok && (
        <p role="alert" className={cn("flex w-full basis-full items-start gap-1.5 text-xs text-destructive")}>
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />{state.error}
        </p>
      )}
    </form>
  )
}
