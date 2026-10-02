import Link from "next/link"
import { Ban } from "lucide-react"
import { SignOutButton } from "./sign-out-button"

export default function RestrictedAccountPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Ban className="size-7" aria-hidden />
        </div>
        <h1 className="mt-6 font-serif text-2xl font-semibold tracking-tight">Account banned</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This account was banned by the Verification Admin, for example because it was reported and confirmed as a
          dummy or fake account. If you think this is a mistake, contact the university&apos;s Verification Admin office.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <SignOutButton />
          <Link href="/auth/login" className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">Back to sign in</Link>
        </div>
      </div>
    </main>
  )
}
