"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { AFFILIATION_LABELS, CAMPUS_LABELS, type Affiliation, type Campus } from "@/lib/roles"
import { validateFullName } from "@/lib/profile-rules"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Eye, EyeOff, AlertCircle } from "lucide-react"
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button"
import { termsAcceptance } from "@/lib/legal"

const AFFILIATIONS = Object.entries(AFFILIATION_LABELS) as [Affiliation, string][]
const CAMPUSES = Object.entries(CAMPUS_LABELS) as [Campus, string][]

export function SignUpForm() {
  const router = useRouter()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [affiliation, setAffiliation] = useState<Affiliation>("student")
  const [idNumber, setIdNumber] = useState("")
  const [department, setDepartment] = useState("")
  const [campus, setCampus] = useState<Campus | "">("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Required: agree to the Terms and Conditions and Privacy Policy (reading them is optional)
  const [agreed, setAgreed] = useState(false)

  const isUniversityMember = affiliation !== "external"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!agreed) {
      setError("Please agree to the Terms and Conditions and Privacy Policy to create an account.")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }

    // Every account must use a real name — dummy accounts can be reported and banned.
    const nameError = validateFullName(`${firstName.trim()} ${lastName.trim()}`)
    if (nameError) {
      setError(nameError)
      return
    }

    if (isUniversityMember && idNumber.trim()) {
      if (!/^\d{8}$/.test(idNumber.trim())) {
        setError("Student / Employee ID must be exactly 8 digits (numbers only).")
        return
      }
    }
    if (isUniversityMember && !campus) {
      setError("Please select your campus.")
      return
    }

    setLoading(true)
    const supabase = createClient()

    // One account per I.D. number.
    if (isUniversityMember && idNumber.trim()) {
      const { data: taken } = await supabase.rpc("id_number_taken", { p_id: idNumber.trim() })
      if (taken === true) {
        setError("An account with this Student / Employee ID already exists. Each person may only have one account.")
        setLoading(false)
        return
      }
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName,
          affiliation,
          student_or_employee_id: isUniversityMember ? idNumber.trim() : null,
          student_employee_id: isUniversityMember ? idNumber.trim() : null,
          department: isUniversityMember ? department.trim() : null,
          campus: isUniversityMember ? campus : null,
          // Accounts start unverified; the Verification Admin approves them via the Verification Queue.
          is_identity_verified: false,
          verification_status: "unverified",
          // Which version of the Terms / Privacy Policy they agreed to, and when (lib/legal.ts)
          ...termsAcceptance(),
        },
      },
    })

    if (signUpError) {
      const msg = signUpError.message.toLowerCase()
      if (msg.includes("already") || msg.includes("registered")) {
        setError("An account with this email may already exist. Try signing in instead.")
      } else if (msg.includes("password")) {
        setError(signUpError.message)
      } else if (msg.includes("rate") || msg.includes("email")) {
        setError(signUpError.message)
      } else {
        setError("Something went wrong while creating your account. Please try again.")
      }
      setLoading(false)
      return
    }

    if (!signUpData.user) {
      setError("Account could not be created. Please try again.")
      setLoading(false)
      return
    }

    // If Supabase returned a live session, the user is already signed in
    if (signUpData.session) {
      // Save the details to the profile right away so checkout and the profile page show them.
      await supabase.from("profiles").upsert({
        id: signUpData.user.id,
        full_name: fullName,
        affiliation,
        student_employee_id: isUniversityMember ? idNumber.trim() || null : null,
        department: isUniversityMember ? department.trim() || null : null,
        campus: isUniversityMember ? campus || null : null,
      }, { onConflict: "id" }).then(() => {}, () => {})
      router.push("/dashboard")
      return
    }

    // Email confirmation is required — direct to success/confirm page
    router.push("/auth/sign-up-success")
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            autoComplete="given-name"
            placeholder="Juan"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="lastName">Surname</Label>
          <Input
            id="lastName"
            autoComplete="family-name"
            placeholder="Dela Cruz"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@sorsu.edu.ph"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="affiliation">University affiliation</Label>
        <Select value={affiliation} onValueChange={(v) => setAffiliation(v as Affiliation)}>
          <SelectTrigger id="affiliation">
            <SelectValue placeholder="Select affiliation" />
          </SelectTrigger>
          <SelectContent>
            {AFFILIATIONS.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {isUniversityMember
            ? "You'll verify this later with your COR or School ID to unlock restricted items."
            : "General public accounts can shop unrestricted items only."}
        </p>
      </div>

      {isUniversityMember && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="idNumber">Student / Employee ID</Label>
            <Input
              id="idNumber"
              placeholder="e.g. 20210123"
              maxLength={8}
              inputMode="numeric"
              pattern="[0-9]{8}"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="department">Department / College</Label>
            <Input
              id="department"
              placeholder="e.g. CICT"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </div>
        </div>
      )}

      {isUniversityMember && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="campus">Campus</Label>
          <Select value={campus} onValueChange={(v) => setCampus(v as Campus)}>
            <SelectTrigger id="campus">
              <SelectValue placeholder="Select your campus" />
            </SelectTrigger>
            <SelectContent>
              {CAMPUSES.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Identifies which SorSU campus you belong to.</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} required
          className="mt-0.5 size-4 shrink-0 rounded accent-primary" aria-describedby="terms-note" />
        <span id="terms-note">
          I have read and agree to the{" "}
          <Link href="/terms" target="_blank" className="font-medium text-primary underline-offset-2 hover:underline">Terms and Conditions</Link>
          {" "}and{" "}
          <Link href="/privacy" target="_blank" className="font-medium text-primary underline-offset-2 hover:underline">Privacy Policy</Link>.
        </span>
      </label>

      <Button type="submit" size="lg" disabled={loading || !agreed} className="mt-1">
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Creating account...
          </>
        ) : (
          "Create account"
        )}
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <GoogleSignInButton />

      <p className="text-center text-sm text-muted-foreground">
        {"Already have an account? "}
        <Link href="/auth/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
