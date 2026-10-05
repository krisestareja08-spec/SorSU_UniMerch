import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Inbox } from "@/components/messages/inbox"

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Messages</h1>
      <div className="mb-4 mt-1.5 h-px bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />
      <Inbox
        perspective="buyer"
        basePath="/marketplace/messages"
        initialId={c ?? null}
        emptyHint={<>No conversations yet. Open a product and tap <span className="font-medium text-foreground">Message Seller</span>. <Link href="/marketplace" className="text-primary hover:underline">Browse products</Link></>}
      />
    </div>
  )
}
