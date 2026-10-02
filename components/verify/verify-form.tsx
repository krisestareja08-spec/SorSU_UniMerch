"use client"

import type React from "react"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AFFILIATION_LABELS, CAMPUS_LABELS, type Affiliation } from "@/lib/roles"
import { validateFullName } from "@/lib/profile-rules"
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

const ACCEPTED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]
// Some browsers report an empty MIME type for Word files, so the extension is checked too.
const ACCEPTED_EXT = [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".doc", ".docx"]
const MAX_BYTES = 5 * 1024 * 1024 // 5MB

export function VerifyForm({
  userId,
  defaultAffiliation,
  defaultFullName,
  defaultStudentId,
  defaultDepartment,
  defaultCourse,
  defaultCampus,
  defaultContact,
  defaultBirthday,
  onSubmitted,
}: {
  userId: string
  defaultAffiliation: Affiliation
  defaultFullName?: string | null
  defaultStudentId?: string | null
  defaultDepartment?: string | null
  defaultCourse?: string | null
  defaultCampus?: string | null
  defaultContact?: string | null
  defaultBirthday?: string | null
  /** When set, called after a successful submit instead of redirecting to /verify/submitted. */
  onSubmitted?: () => void
}) {
  const router = useRouter()
    const [affiliation, setAffiliation] = useState<Affiliation>(
    defaultAffiliation === "external" ? "student" : defaultAffiliation,
  )
  const [fullName, setFullName] = useState(defaultFullName ?? "")
  const [studentId, setStudentId] = useState(defaultStudentId ?? "")
  const [department, setDepartment] = useState(defaultDepartment ?? "")
  const [course, setCourse] = useState(defaultCourse ?? "")
  const [campus, setCampus] = useState(defaultCampus ?? "")
  const [contact, setContact] = useState(defaultContact ?? "")
  const [birthday, setBirthday] = useState(defaultBirthday ?? "")
  const [confirmed, setConfirmed] = useState(false)
  const [idFile, setIdFile] = useState<File | null>(null)
  const [corFile, setCorFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function validate(f: File): string | null {
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase()
    if (!ACCEPTED.includes(f.type) && !ACCEPTED_EXT.includes(ext)) {
      return "Please upload an image (JPG, PNG, WEBP), PDF, or Word document (DOC, DOCX)."
    }
    if (f.size > MAX_BYTES) return "File is too large. Maximum size is 5 MB."
    return null
  }

  const needsCor = affiliation === "student"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const nameError = validateFullName(fullName)
    if (nameError) {
      setError(nameError)
      return
    }
    if (!studentId.trim()) {
      setError("Please enter your student / employee ID.")
      return
    }
    if (affiliation === "student" && !course.trim()) {
      setError("Please enter your course / program.")
      return
    }
    if (!department.trim()) {
      setError("Please enter your department / college.")
      return
    }
    if (!campus) {
      setError("Please select your campus.")
      return
    }
    if (!contact.trim()) {
      setError("Please enter your contact number.")
      return
    }
    if (!idFile) {
      setError("Please attach your school / employee I.D.")
      return
    }
    if (needsCor && !corFile) {
      setError("Students must also attach their Certificate of Registration (COR).")
      return
    }
    if (!confirmed) {
      setError("Please confirm that your information is true and complete.")
      return
    }

    setLoading(true)
    const supabase = createClient()

    // One account per I.D. number.
    const { data: taken } = await supabase.rpc("id_number_taken", { p_id: studentId.trim() })
    if (taken === true) {
      setError("This I.D. number is already used by another account. Each person may only have one account.")
      setLoading(false)
      return
    }

    // Files are namespaced by user id so storage RLS accepts them.
    async function upload(kind: "id" | "cor", f: File) {
      const ext = f.name.split(".").pop() || "bin"
      const path = `${userId}/${kind}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from("verification-docs")
        .upload(path, f, { cacheControl: "3600", upsert: false })
      if (uploadError) uploadMessage = uploadError.message
      return uploadError ? null : path
    }

    let uploadMessage = ""
    const idPath = await upload("id", idFile)
    const corPath = needsCor && corFile ? await upload("cor", corFile) : null
    if (!idPath || (needsCor && !corPath)) {
      setError(`Could not upload your documents${uploadMessage ? ` (${uploadMessage})` : ""}. Please try again.`)
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase.from("verification_requests").insert({
      user_id: userId,
      full_name: fullName.trim(),
      student_employee_id: studentId.trim(),
      department: department.trim() || null,
      course: course.trim() || null,
      document_type: "school_id",
      document_url: idPath,
      cor_url: corPath,
      claimed_affiliation: affiliation,
      status: "pending",
    })

    if (insertError) {
      setError(`Your documents uploaded but we couldn't submit the request (${insertError.message}). Please try again.`)
      setLoading(false)
      return
    }

    // Keep the profile in sync with the identity info just submitted.
    await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        student_employee_id: studentId.trim(),
        department: department.trim() || null,
        course: course.trim() || null,
        campus,
        contact: contact.trim(),
        birthday: birthday || null,
        verification_status: "pending",
      })
      .eq("id", userId)

    if (onSubmitted) {
      setLoading(false)
      onSubmitted()
      return
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
        <Label htmlFor="fullName">Full name</Label>
        <input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="As shown on your ID/COR"
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="studentId">Student / employee ID</Label>
        <input
          id="studentId"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          placeholder="e.g. 2021-00123"
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="course">Course / program{affiliation === "student" ? "" : " (optional)"}</Label>
        <input
          id="course"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          placeholder="e.g. BS Information Technology"
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="department">Department / college</Label>
        <input
          id="department"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="e.g. CICT"
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="campus">Campus</Label>
        <Select value={campus} onValueChange={(v) => setCampus(v ?? "")}>
          <SelectTrigger id="campus">
            <SelectValue placeholder="Select your campus" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CAMPUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="contact">Contact number</Label>
          <input
            id="contact"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="e.g. 09XX XXX XXXX"
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="birthday">Birthday (optional)</Label>
          <input
            id="birthday"
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="affiliation">Applying as</Label>
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
          Students submit their I.D. and COR; faculty and staff submit their I.D. only.
        </p>
      </div>

      <DocPicker
        label={affiliation === "student" ? "School I.D." : "School / employee I.D."}
        file={idFile}
        onPick={(f) => { const err = validate(f); setError(err); if (!err) setIdFile(f) }}
        onClear={() => setIdFile(null)}
      />

      {needsCor && (
        <DocPicker
          label="Certificate of Registration (COR)"
          file={corFile}
          onPick={(f) => { const err = validate(f); setError(err); if (!err) setCorFile(f) }}
          onClear={() => setCorFile(null)}
        />
      )}

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5"
        />
        <span>I confirm that the information above is true and complete, and the uploaded documents are mine.</span>
      </label>

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

function DocPicker({
  label,
  file,
  onPick,
  onClear,
}: {
  label: string
  file: File | null
  onPick: (f: File) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept={[...ACCEPTED, ...ACCEPTED_EXT].join(",")}
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f) }}
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
            onClick={() => { onClear(); if (inputRef.current) inputRef.current.value = "" }}
            aria-label="Remove file"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/60"
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-accent/40 text-accent-foreground">
            <Upload className="size-5" />
          </span>
          <span className="text-sm font-medium">Click to upload</span>
          <span className="text-xs text-muted-foreground">Image, PDF, or Word document up to 5 MB</span>
        </button>
      )}
    </div>
  )
}
