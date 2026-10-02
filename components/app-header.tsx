"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { NotificationBell } from "@/components/notifications/notification-bell"

export function AppHeader({
  fullName,
  email,
}: {
  fullName: string | null
  email: string
}) {
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  const initials =
    (fullName || email)
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U"

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Image
            src="/sorsu-seal.png"
            alt="Sorsogon State University seal"
            width={36}
            height={36}
            className="rounded-full ring-1 ring-border"
          />
          <span className="hidden font-serif text-base font-semibold sm:inline">
            <span className="text-primary">Uni</span>
            <span className="text-gold">Merch</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <NotificationBell />
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {initials}
            </span>
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-medium">{fullName || "Member"}</p>
              <p className="text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
