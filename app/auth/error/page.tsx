import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" aria-hidden />
        </div>
        <h1 className="mt-6 text-balance font-serif text-2xl font-semibold tracking-tight">
          Authentication link problem
        </h1>
        <p className="mt-3 text-pretty text-sm text-muted-foreground">
          This link may have expired or already been used. Please try signing in again, or request a new confirmation
          email by signing up.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Button asChild size="lg">
            <Link href="/auth/login">Go to sign in</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/auth/sign-up">Create a new account</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
