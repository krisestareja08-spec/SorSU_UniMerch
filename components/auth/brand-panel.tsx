import Image from "next/image"
import { ShieldCheck, Store, BadgeCheck } from "lucide-react"

const points = [
  {
    icon: Store,
    title: "One centralized campus store",
    body: "Colleges, offices, and accredited vendors sell in a single official marketplace.",
  },
  {
    icon: BadgeCheck,
    title: "Verified university identity",
    body: "Upload your COR or School ID to unlock restricted items like faculty uniforms.",
  },
  {
    icon: ShieldCheck,
    title: "Governed by the university",
    body: "The BAO, Supply Office, and Verification Admin oversee listings, restrictions, and orders.",
  },
]

export function BrandPanel() {
  return (
    <aside className="relative hidden h-full flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sidebar-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-sidebar-accent/40 blur-3xl"
      />

      <div className="relative flex items-center gap-3">
        <Image
          src="/sorsu-seal.png"
          alt="Sorsogon State University seal"
          width={52}
          height={52}
          className="rounded-full ring-2 ring-sidebar-primary/60"
        />
        <div className="leading-tight">
          <p className="font-serif text-lg font-semibold tracking-tight">SorSU Marketplace</p>
          <p className="text-xs text-sidebar-foreground/70">Sorsogon State University</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <h2 className="text-balance font-serif text-3xl font-semibold leading-tight">
          The official centralized store of the university.
        </h2>
        <p className="mt-3 text-pretty text-sm text-sidebar-foreground/75">
          Anyone can create an account. Verified members unlock restricted, role-based items.
        </p>

        <ul className="mt-8 flex flex-col gap-5">
          {points.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/15 text-sidebar-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-sm text-sidebar-foreground/70">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-sidebar-foreground/60">
        {"\u00A9 "}
        {new Date().getFullYear()} Sorsogon State University. All rights reserved.
      </p>
    </aside>
  )
}
