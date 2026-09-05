"use client"

import type React from "react"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AFFILIATION_LABELS, type Affiliation } from "@/lib/roles"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Upload, FileText, X, AlertCircle } from "lucide-react"

const MEMBER_AFFILIATIONS = (Object.entries(AFFILIATION_LABELS) as [Affiliation, string][]).filter(
  ([v]) => v !== "external",
)

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
const MAX_BYTES = 5 * 1024 * 1024 // 5MB

export function VerifyForm({
  userId,
  defaultAffiliation,
}: {
  userId: string
  defaultAffiliation: Affiliation
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [docType, setDocType] = useState<"cor" | "school_id">("school_id")
  const [affiliation, setAffiliation] = useState<Affiliation>(
    defaultAffiliation === "external" ? "student" : defaultAffiliation,
  )
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function pickFile(f: File | undefined) {
    setError(null)
    if (!f) return
    if (!ACCEPTED.includes(f.type)) {
      setError("Please upload a JPG, PNG, WEBP, or PDF file.")
      return
    }
    if (f.size > MAX_BYTES) {
      setError("File is too large. Maximum size is 5 MB.")
      return
    }
    setFile(f)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!file) {
      setError("Please attach your document before submitting.")
      return
    }

    setLoading(true)
    const supabase = createClient()

    // Files are namespaced by user id so storage RLS accepts them.
    const ext = file.name.split(".").pop() || "bin"
    const path = `${userId}/${docType}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("verification-docs")
      .upload(path, file, { cacheControl: "3600", upsert: false })

    if (uploadError) {
      setError("Could not upload your document. Please try again.")
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase.from("verification_requests").insert({
      user_id: userId,
      document_type: docType,
      document_path: path,
      claimed_affiliation: affiliation,
      status: "pending",
    })

    if (insertError) {
      setError("Your document uploaded but we couldn't submit the request. Please try again.")
      setLoading(false)
      return
    }

    // Reflect pending state on the profile when the table exists. If it does not, we still
    // keep the verification request record and let the UI use the auth metadata fallback.
    try {
      await supabase.from("profiles").update({ verification_status: "pending" }).eq("id", userId)
    } catch {
      // Ignore profile updates when the table isn't present.
    }

    router.push("/verify/submitted")
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="affiliation">Affiliation to verify</Label>
        <Select value={affiliation} onValueChange={(v) => setAffiliation(v as Affiliation)}>
          <SelectTrigger id="affiliation">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEMBER_AFFILIATIONS.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          This determines which restricted items you can buy (e.g. faculty can buy faculty uniforms).
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="docType">Document type</Label>
        <Select value={docType} onValueChange={(v) => setDocType(v as "cor" | "school_id")}>
          <SelectTrigger id="docType">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="school_id">School ID</SelectItem>
            <SelectItem value="cor">Certificate of Registration (COR)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Upload document</Label>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="sr-only"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />

        {file ? (
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="size-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setFile(null)
                if (inputRef.current) inputRef.current.value = ""
              }}
              aria-label="Remove file"
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-muted/60"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-accent/40 text-accent-foreground">
              <Upload className="size-5" />
            </span>
            <span className="text-sm font-medium">Click to upload</span>
            <span className="text-xs text-muted-foreground">JPG, PNG, WEBP, or PDF up to 5 MB</span>
          </button>
        )}
      </div>

      <Button type="submit" size="lg" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Submitting...
          </>
        ) : (
          "Submit for verification"
        )}
      </Button>
    </form>
  )
}
