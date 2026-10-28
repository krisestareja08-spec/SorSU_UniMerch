import { createBrowserClient } from '@supabase/ssr'
import { createClient as createPlainClient } from '@supabase/supabase-js'

function supabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    )
  }
  return { supabaseUrl, supabaseKey }
}

export function createClient() {
  const { supabaseUrl, supabaseKey } = supabaseEnv()
  return createBrowserClient(supabaseUrl, supabaseKey, {
    // Secure cookies in production; not in dev, so localhost still works.
    cookieOptions: { secure: process.env.NODE_ENV === 'production' },
  })
}

/**
 * Only for sending a password-reset email. Its link then carries the sign-in itself (read by
 * /auth/reset), so it works in whichever browser or app opens the email. Links from the normal
 * client only work in the browser that asked for them, which fails when the email app opens
 * another one.
 */
export function createEmailLinkClient() {
  const { supabaseUrl, supabaseKey } = supabaseEnv()
  return createPlainClient(supabaseUrl, supabaseKey, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/**
 * The signed-in user's id from the local session — no request to the Auth server, so widgets that
 * mount on every page (cart, alerts, bell) stay cheap. Only use it to choose which rows to load or
 * subscribe to: row-level security still checks every query on the server.
 */
export async function currentUserId() {
  const { data } = await createClient().auth.getSession()
  return data.session?.user.id ?? null
}
