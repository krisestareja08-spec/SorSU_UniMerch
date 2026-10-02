import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BrandPanel } from "@/components/auth/brand-panel"
import { SignUpForm } from "@/components/auth/sign-up-form"

export default async function SignUpPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect("/")

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <BrandPanel />

      <div className="flex flex-col px-6 py-8 sm:px-10">
        <header className="flex items-center justify-between lg:hidden">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/sorsu-seal.png"
              alt="Sorsogon State University seal"
              width={40}
              height={40}
              className="rounded-full ring-1 ring-border"
            />
            <span className="font-serif text-base font-semibold">SorSU Marketplace</span>
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md py-10">
            <div className="mb-8">
              <p className="text-sm font-medium text-primary">Join the marketplace</p>
              <h1 className="mt-1 text-balance font-serif text-3xl font-semibold tracking-tight">Create your account</h1>
            </div>

            <SignUpForm />
          </div>
        </div>

        <footer className="text-center text-xs text-muted-foreground lg:text-left">
          By creating an account you agree to the university marketplace{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            terms of use
          </Link>
          .
        </footer>
      </div>
    </main>
  )
}
