import Image from "next/image"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { UniMerchWordmark } from "@/components/brand/unimerch-wordmark"
import { BrandPanel } from "@/components/auth/brand-panel"
import { LoginForm } from "@/components/auth/login-form"
import Link from "next/link"

export default async function LoginPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect("/")

  return (
    // Phones/tablets: curved maroon hero with the seal, form card below (unchanged).
    // Desktop (lg+): split layout like sign-up — brand panel left, form right, all on one screen.
    // dvh, not vh: on phones 100vh is taller than the visible area (browser bars), which made the page scroll
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-background lg:grid lg:h-dvh lg:min-h-160 lg:grid-cols-2">
      <BrandPanel />

      {/* "contents" keeps the phone layout exactly as before; on desktop this becomes the form column */}
      <div className="contents lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto lg:px-10 lg:py-8">
        {/* Curved maroon hero with the university seal resting on its edge (phones/tablets) */}
        <div className="relative shrink-0 lg:hidden">
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

        <div className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col px-6 pb-4 sm:pb-6 lg:max-w-md lg:justify-center lg:px-0 lg:pb-0">
          <UniMerchWordmark size="md" showSeal={false} className="mt-12 sm:mt-16 lg:hidden" />

          <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-lg shadow-primary/5 sm:mt-7 sm:p-5 lg:mt-0 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            <div className="mb-3 text-center sm:mb-4 lg:mb-8 lg:text-left">
              <p className="hidden text-sm font-medium text-primary lg:block">Welcome back</p>
              <h1 className="font-serif text-lg font-semibold lg:mt-1 lg:text-3xl lg:tracking-tight">
                <span className="lg:hidden">Welcome back</span>
                <span className="hidden lg:inline">Sign in to UniMerch</span>
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground lg:mt-2">Sign in to continue to the marketplace</p>
            </div>
            <LoginForm />
          </section>

          <p className="mx-auto mt-3 max-w-xs text-pretty text-center text-xs text-muted-foreground sm:mt-5 lg:mx-0 lg:mt-8 lg:max-w-none lg:rounded-xl lg:bg-muted/50 lg:px-4 lg:py-3 lg:text-left max-lg:[@media(max-height:700px)]:hidden">
            Browsing and buying are open to everyone. Verification only unlocks restricted, role-based items.
          </p>

          <p className="mt-auto pt-3 text-center sm:pt-6 lg:mt-8 lg:pt-0 lg:text-left max-lg:[@media(max-height:700px)]:hidden text-xs text-muted-foreground/60">
            <Link href="/terms" className="hover:text-foreground hover:underline">Terms</Link>{" · "}
            <Link href="/privacy" className="hover:text-foreground hover:underline">Privacy</Link>{" · "}
            Est. 2026 · Bulan, Sorsogon
          </p>
        </div>
      </div>
    </main>
  )
}
