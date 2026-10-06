import Image from "next/image"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { UniMerchWordmark } from "@/components/brand/unimerch-wordmark"
import { LoginForm } from "@/components/auth/login-form"

export default async function LoginPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect("/")

  return (
    // dvh, not vh: on phones 100vh is taller than the visible area (browser bars), which made the page scroll
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      {/* Curved maroon hero with the university seal resting on its edge */}
      <div className="relative shrink-0">
        <div
          aria-hidden
          className="h-[13dvh] min-h-20 max-h-28 rounded-b-[45%] bg-linear-to-b from-primary to-primary/85 sm:h-[32vh] sm:min-h-45 sm:max-h-none"
        />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
          <div className="rounded-full bg-card p-1.5 shadow-xl ring-2 ring-gold/50 sm:p-2">
            <Image
              src="/sorsu-seal.png"
              alt="Sorsogon State University seal"
              width={92}
              height={92}
              priority
              className="size-18 rounded-full sm:size-23"
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col px-6 pb-4 sm:pb-6">
        <UniMerchWordmark size="md" showSeal={false} className="mt-12 sm:mt-16" />

        <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-lg shadow-primary/5 sm:mt-7 sm:p-5">
          <div className="mb-3 text-center sm:mb-4">
            <h1 className="font-serif text-lg font-semibold">Welcome back</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Sign in to continue to the marketplace</p>
          </div>
          <LoginForm />
        </section>

        <p className="mx-auto mt-3 max-w-xs text-pretty text-center text-xs text-muted-foreground sm:mt-5 [@media(max-height:700px)]:hidden">
          Browsing and buying are open to everyone. Verification only unlocks restricted, role-based items.
        </p>

        <p className="mt-auto pt-3 text-center sm:pt-6 [@media(max-height:700px)]:hidden text-xs text-muted-foreground/60">Est. 2026 · Bulan, Sorsogon</p>
      </div>
    </main>
  )
}
