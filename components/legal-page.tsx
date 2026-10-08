import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { TERMS_UPDATED } from "@/lib/legal"

export type LegalSection = { title: string; points: React.ReactNode[] }

/** Shared layout for the Terms and Conditions and the Privacy Policy. */
export function LegalPage({ title, intro, sections, other }: {
  title: string
  intro: React.ReactNode
  sections: LegalSection[]
  other: { href: string; label: string }
}) {
  return (
    <main className="min-h-dvh bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />UniMerch
        </Link>
        <div className="mt-6 flex items-center gap-3">
          <Image src="/sorsu-seal.png" alt="Sorsogon State University seal" width={44} height={44} className="rounded-full ring-1 ring-border" />
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">UniMerch — Sorsogon State University campus marketplace · Last updated {TERMS_UPDATED}</p>
          </div>
        </div>
        <div className="mt-3 h-px bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />
        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{intro}</p>

        <div className="mt-6 space-y-6">
          {sections.map((s, i) => (
            <section key={s.title} aria-labelledby={`legal-${i}`}>
              <h2 id={`legal-${i}`} className="font-serif text-lg font-semibold text-foreground">{i + 1}. {s.title}</h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
                {s.points.map((p, j) => <li key={j}>{p}</li>)}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-8 border-t border-border pt-4 text-sm text-muted-foreground">
          See also our <Link href={other.href} className="font-medium text-primary hover:underline">{other.label}</Link>.
        </p>
      </div>
    </main>
  )
}
