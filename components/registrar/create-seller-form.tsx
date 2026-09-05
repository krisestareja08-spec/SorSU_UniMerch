"use client"

import { useState, useTransition } from "react"
import { Loader2, Store, Mail, Lock, BookOpen, Tag, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createSellerAccount } from "@/app/registrar/new-seller/actions"

const ORG_CATEGORIES = [
  "Student Organization", "Academic Department", "Faculty Association",
  "Student Council", "Events & Activities", "Supply & Procurement", "Other",
]

export function CreateSellerForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState("")

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    if (!category) { setError("Please select an organization category."); return }
    fd.set("category", category)
    startTransition(async () => {
      try {
        await createSellerAccount(fd)
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

      <div className="h-px bg-border" />

      <p className="text-xs text-muted-foreground">Login credentials for the organization&apos;s seller account:</p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">
          <Mail className="inline size-3.5 mr-1" />Login Email *
        </Label>
        <Input id="email" name="email" type="email" placeholder="org@sorsu.edu.ph" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">
          <Lock className="inline size-3.5 mr-1" />Temporary Password *
        </Label>
        <Input id="password" name="password" type="password" placeholder="Minimum 8 characters" minLength={8} required />
        <p className="text-xs text-muted-foreground">The organization should change this password after first login.</p>
      </div>

      <Button type="submit" disabled={isPending} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
        {isPending ? (
          <><Loader2 className="size-4 animate-spin" /> Creating Account...</>
        ) : (
          <><CheckCircle2 className="size-4" /> Create Seller Account</>
        )}
      </Button>
    </form>
  )
}
