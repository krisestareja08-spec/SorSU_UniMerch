"use client"

import { useState, useTransition } from "react"
import { Loader2, Store, Mail, Lock, BookOpen, Tag, MapPin, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createOrganization } from "@/app/admin/sellers/actions"
import { CAMPUS_LABELS, type Campus } from "@/lib/roles"

const ORG_CATEGORIES = [
  "Student Organization", "Academic Department", "Faculty Association",
  "Student Council", "Events & Activities", "Supply & Procurement", "Other",
]

const CAMPUSES = Object.entries(CAMPUS_LABELS) as [Campus, string][]

export function CreateSellerForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState("")
  const [campus, setCampus] = useState<Campus | "">("")
  const [adminMode, setAdminMode] = useState<"existing" | "new">("existing")

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    if (!category) { setError("Please select an organization category."); return }
    if (!campus) { setError("Please select a campus."); return }
    fd.set("category", category)
    fd.set("campus", campus)
    fd.set("admin_mode", adminMode)
    startTransition(async () => {
      try {
        await createOrganization(fd)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong.")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="org_name">
          <Store className="inline size-3.5 mr-1" />Organization Name *
        </Label>
        <Input id="org_name" name="org_name" placeholder="e.g. CICT Student Council" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">
          <BookOpen className="inline size-3.5 mr-1" />Description
        </Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder="Brief description of the organization..."
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>
          <Tag className="inline size-3.5 mr-1" />Organization Category *
        </Label>
        <Select value={category} onValueChange={(value) => setCategory(value ?? "")}>
          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>
            {ORG_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>
          <MapPin className="inline size-3.5 mr-1" />Campus *
        </Label>
        <Select value={campus} onValueChange={(value) => setCampus((value as Campus) ?? "")}>
          <SelectTrigger><SelectValue placeholder="Select campus" /></SelectTrigger>
          <SelectContent>
            {CAMPUSES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Identifies which SorSU campus this organization belongs to.</p>
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-2">
        <Label>Main Admin of this organization&apos;s Seller Dashboard *</Label>
        <p className="text-xs text-muted-foreground">
          The Main Admin has full control of the dashboard and can add members and limit what they can do.
        </p>
        <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {([["existing", "Existing user"], ["new", "Create new login"]] as const).map(([mode, label]) => (
            <button key={mode} type="button" onClick={() => setAdminMode(mode)}
              className={`flex-1 rounded-lg py-1.5 text-sm font-medium ${adminMode === mode ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {adminMode === "new" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="admin_name">Main Admin full name *</Label>
          <Input id="admin_name" name="admin_name" placeholder="e.g. Juan Dela Cruz" required />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">
          <Mail className="inline size-3.5 mr-1" />{adminMode === "existing" ? "Main Admin's account email *" : "Login email *"}
        </Label>
        <Input id="email" name="email" type="email" placeholder="name@sorsu.edu.ph" required />
        {adminMode === "existing" && (
          <p className="text-xs text-muted-foreground">The person must already have a UniMerch account.</p>
        )}
      </div>

      {adminMode === "new" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">
            <Lock className="inline size-3.5 mr-1" />Temporary Password *
          </Label>
          <Input id="password" name="password" type="password" placeholder="Minimum 8 characters" minLength={8} required />
          <p className="text-xs text-muted-foreground">They should change this password after first login.</p>
        </div>
      )}

      <Button type="submit" disabled={isPending} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
        {isPending ? (
          <><Loader2 className="size-4 animate-spin" /> Creating organization...</>
        ) : (
          <><CheckCircle2 className="size-4" /> Create organization</>
        )}
      </Button>
    </form>
  )
}
