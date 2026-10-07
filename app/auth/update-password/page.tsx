import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PasswordChange } from "@/components/account/password-change"
import { Button } from "@/components/ui/button"

/** Opened from the password-reset email (signed in by /auth/callback): choose a new password. */
export default async function UpdatePasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // No session: the link was already used or has expired
  if (!user) redirect("/auth/forgot-password")

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <Image src="/sorsu-seal.png" alt="Sorsogon State University seal" width={56} height={56} className="mx-auto rounded-full ring-1 ring-border" />
        <h1 className="mt-8 text-center font-serif text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">For {user.email}</p>
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <PasswordChange />
        </div>
        <Button asChild variant="outline" className="mt-4 w-full">
          <Link href="/">Continue to UniMerch</Link>
        </Button>
      </div>
    </main>
  )
}
