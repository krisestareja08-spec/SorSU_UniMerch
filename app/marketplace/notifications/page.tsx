import Link from "next/link"
import { redirect } from "next/navigation"
import { Settings } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { NotificationCenter } from "@/components/notifications/notification-center"

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Notifications</h1>
        <Link href="/marketplace/settings#notifications" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <Settings className="size-3.5" />Preferences
        </Link>
      </div>
      <div className="mb-4 mt-1.5 h-px bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />
      <NotificationCenter />
    </div>
  )
}
