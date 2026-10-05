"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { resetTheme } from "@/lib/theme"

export function SignOutButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={async () => { await createClient().auth.signOut(); resetTheme(); router.push("/auth/login"); router.refresh() }}
      className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
    >
      Sign out
    </button>
  )
}
