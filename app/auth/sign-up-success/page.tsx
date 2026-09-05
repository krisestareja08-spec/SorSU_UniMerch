import Image from "next/image"
import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function SignUpSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md text-center">
        <Image
          src="/sorsu-seal.png"
          alt="Sorsogon State University seal"
          width={56}
          height={56}
          className="mx-auto rounded-full ring-1 ring-border"
        />
        <div className="mx-auto mt-8 flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          <CheckCircle2 className="size-7" aria-hidden />
        </div>
        <h1 className="mt-6 text-balance font-serif text-2xl font-semibold tracking-tight">Account created</h1>
        <p className="mt-3 text-pretty text-sm text-muted-foreground">
          Your SorSU Marketplace account is ready. Sign in below to start shopping and complete any identity checks
          required for your role.
        </p>
        <Button asChild size="lg" className="mt-8 w-full">
          <Link href="/auth/login">Go to sign in</Link>
        </Button>
      </div>
    </main>
  )
}
