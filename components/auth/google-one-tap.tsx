"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Script from "next/script"
import { createClient } from "@/lib/supabase/client"

// Minimal shape of the Google Identity Services API we use.
type GoogleIdCredentialResponse = { credential: string }
type GoogleAccountsId = {
  initialize: (config: {
    client_id: string
    callback: (response: GoogleIdCredentialResponse) => void
    nonce: string
    use_fedcm_for_prompt?: boolean
  }) => void
  prompt: () => void
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

async function sha256Hex(value: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("")
}

// crypto.randomUUID needs a secure context (https or localhost) and isn't on
// every browser version; fall back to getRandomValues when it's missing.
function randomUUID() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Renders Google's "One Tap" prompt. No-ops if NEXT_PUBLIC_GOOGLE_CLIENT_ID
 * isn't configured, so it's safe to mount even before Google OAuth is set up.
 */
export function GoogleOneTap() {
  const router = useRouter()
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const initialized = useRef(false)

  useEffect(() => {
    if (!clientId || initialized.current) return

    let cancelled = false

    async function init() {
      if (!window.google || cancelled) return
      // Web Crypto (subtle/randomUUID) requires a secure context; bail out quietly if unavailable.
      if (typeof crypto === "undefined" || !crypto.subtle) return
      const rawNonce = randomUUID()
      const hashedNonce = await sha256Hex(rawNonce)

      window.google.accounts.id.initialize({
        client_id: clientId!,
        nonce: hashedNonce,
        use_fedcm_for_prompt: true,
        callback: async ({ credential }) => {
          const supabase = createClient()
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: credential,
            nonce: rawNonce,
          })
          if (!error) {
            router.push("/")
            router.refresh()
          }
        },
      })
      window.google.accounts.id.prompt()
      initialized.current = true
    }

    // The gsi script (loaded via next/script) may not be ready yet on first render.
    const interval = setInterval(() => {
      if (window.google) {
        clearInterval(interval)
        init()
      }
    }, 200)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [clientId, router])

  if (!clientId) return null

  return <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
}
