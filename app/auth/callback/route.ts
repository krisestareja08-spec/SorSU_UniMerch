import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const user = data.user
      if (user) {
        // OAuth sign-ins (e.g. Google) don't go through the sign-up form, so make sure a
        // profile row exists. Defaults to buyer/external via the table's column defaults.
        // ignoreDuplicates means this never overwrites an already-provisioned profile.
        const meta = user.user_metadata ?? {}
        const fullName = (meta.full_name as string) || (meta.name as string) || null
        const avatarUrl = (meta.avatar_url as string) || (meta.picture as string) || null
        await supabase
          .from('profiles')
          .upsert({ id: user.id, full_name: fullName, avatar_url: avatarUrl }, { onConflict: 'id', ignoreDuplicates: true })
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
