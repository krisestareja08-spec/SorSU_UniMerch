import Image from "next/image"
import { VerifiedBadge } from "@/components/verified-badge"
import { AFFILIATION_LABELS, CAMPUS_LABELS, type Affiliation, type Campus } from "@/lib/roles"
import { type AdminProfile, formatDateTime } from "@/lib/admin"
import { Download, FileText } from "lucide-react"

/** Full profile information card used on the queue and user detail pages. */
export function ProfileDetails({ profile, email }: { profile: AdminProfile; email?: string | null }) {
  const rows: [string, React.ReactNode][] = [
    ["Full name", profile.full_name || "—"],
    ["Email", email || "—"],
    ["Affiliation", profile.is_identity_verified ? AFFILIATION_LABELS[profile.affiliation as Affiliation] ?? "—" : "Guest (unverified)"],
    ["I.D. number", profile.student_employee_id || "—"],
    ["Course / program", profile.course || "—"],
    ["Department / college", profile.department || "—"],
    ["Campus", CAMPUS_LABELS[profile.campus as Campus] ?? profile.campus ?? "—"],
    ["Contact number", profile.contact || "—"],
    ["Birthday", profile.birthday || "—"],
    ["Account status", <span key="s" className="capitalize">{profile.account_status ?? "active"}</span>],
    ["Joined", profile.created_at ? formatDateTime(profile.created_at) : "—"],
  ]

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-4">
        <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-lg font-bold text-primary">
          {profile.avatar_url
            ? <Image src={profile.avatar_url} alt="" fill className="object-cover" />
            : (profile.full_name || "U").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-serif text-lg font-semibold text-foreground">{profile.full_name || "Unnamed user"}</p>
          <VerifiedBadge verified={profile.is_identity_verified} affiliation={profile.affiliation} className="mt-1" />
        </div>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col border-b border-border/60 pb-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Inline preview of an uploaded verification document (image / PDF / Word). */
export function DocumentPreview({ label, url, path }: { label: string; url: string | null; path: string | null }) {
  const ext = (path ?? "").split(".").pop()?.toLowerCase() ?? ""
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><FileText className="size-4 text-primary" />{label}</p>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <Download className="size-3" /> Open / download
          </a>
        )}
      </div>
      {!path ? (
        <p className="text-sm text-muted-foreground">Not uploaded.</p>
      ) : !url ? (
        <p className="text-sm text-destructive">Could not load this file. Make sure <code>scripts/8_verification_storage.sql</code> has been run.</p>
      ) : ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="max-h-[520px] w-full rounded-xl border border-border object-contain" />
      ) : ext === "pdf" ? (
        <iframe src={url} title={label} className="h-[520px] w-full rounded-xl border border-border" />
      ) : (
        <p className="text-sm text-muted-foreground">Word document ({ext.toUpperCase()}) — use “Open / download” to view it.</p>
      )}
    </div>
  )
}
