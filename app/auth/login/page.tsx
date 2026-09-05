import Image from "next/image"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { roleHome } from "@/lib/roles"
import { profileFromUser } from "@/lib/profile"
import { UniMerchWordmark } from "@/components/brand/unimerch-wordmark"
import { LoginForm } from "@/components/auth/login-form"

export default async function LoginPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    const profileRole = error || !data ? profileFromUser(user).role : (data.role ?? "buyer")
    redirect(roleHome(profileRole))
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Curved maroon hero with the university seal resting on its edge */}
      <div className="relative shrink-0">
        <div
          aria-hidden
          className="h-[32vh] min-h-[180px] rounded-b-[45%] bg-gradient-to-b from-primary to-primary/85"
        />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
          <div className="rounded-full bg-card p-2 shadow-xl ring-2 ring-gold/50">
            <Image
              src="/sorsu-seal.png"
              alt="Sorsogon State University seal"
              width={92}
              height={92}
              priority
              className="size-[92px] rounded-full"
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col px-6 pb-6">
        <UniMerchWordmark size="md" showSeal={false} className="mt-16" />

        <section className="mt-7 rounded-2xl border border-border bg-card p-5 shadow-lg shadow-primary/5">
          <div className="mb-4 text-center">
            <h1 className="font-serif text-lg font-semibold">Welcome back</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Sign in to continue to the marketplace</p>
          </div>
          <LoginForm />
        </section>

        <p className="mx-auto mt-5 max-w-xs text-pretty text-center text-xs text-muted-foreground">
          Browsing and buying are open to everyone. Verification only unlocks restricted, role-based items.
        </p>

        <p className="mt-auto pt-6 text-center text-xs text-muted-foreground/60">Est. 1907 · Bulan, Sorsogon</p>
      </div>
    </main>
  )
}
