"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { MessageCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

/** Header Messages icon with the buyer's unread count, kept live with Supabase Realtime. */
export function MessagesLink() {
  const [unread, setUnread] = useState(0)

  const load = useCallback(async () => {
    const { data, error } = await createClient().rpc("unread_message_count")
    setUnread(error ? 0 : Number(data) || 0)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const first = setTimeout(load, 0)
    // Any message insert or read-receipt we can see changes the count
    const channel = supabase
      .channel("header-unread-messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_messages" }, () => load())
      .subscribe()
    window.addEventListener("focus", load)
    return () => { clearTimeout(first); supabase.removeChannel(channel); window.removeEventListener("focus", load) }
  }, [load])

  return (
    <Link href="/marketplace/messages" className="relative rounded-lg p-2 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 active:scale-95"
      aria-label={unread ? `Messages, ${unread} unread` : "Messages"}>
      <MessageCircle className="size-5" />
      {unread > 0 && (
        <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold leading-4 text-primary">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  )
}
