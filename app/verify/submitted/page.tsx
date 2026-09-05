import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Clock } from "lucide-react"

export default async function VerifySubmittedPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent/40 text-accent-foreground">
          <Clock className="size-7" aria-hidden />
        </div>
        <h1 className="mt-6 text-balance font-serif text-2xl font-semibold tracking-tight">Submission received</h1>
        <p className="mt-3 text-pretty text-sm text-muted-foreground">
          Your document was submitted for review. The Registrar will verify your university identity, and your account
          will be updated once approved. Restricted items unlock automatically after approval.
        </p>
        <Button asChild size="lg" className="mt-8 w-full">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </main>
  )
}
