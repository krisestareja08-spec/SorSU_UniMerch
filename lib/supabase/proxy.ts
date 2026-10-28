import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hasAcceptedTerms } from '@/lib/legal'
import { canShopAsMember } from '@/lib/member-shopping'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    )
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    // Secure cookies in production; not in dev, so localhost still works.
    cookieOptions: { secure: process.env.NODE_ENV === 'production' },
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        )
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  // getClaims() refreshes the session and verifies the JWT locally (no round trip to the Auth
  // server on every request, unlike getUser()).
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  const user = claims?.sub ? { id: claims.sub, user_metadata: claims.user_metadata ?? {} } : null

  const protectedPrefixes = [
    '/dashboard',
    '/verify',
    '/marketplace',
    '/seller',
    '/bao',
    '/supply-office',
    '/cashier',
    '/admin',
    '/account',
  ]
  // Seller storefronts (/seller/{uuid}) are public; the rest of /seller is the Seller Dashboard.
  const isPublicStorefront = /^\/seller\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i.test(request.nextUrl.pathname)
  const isProtected = !isPublicStorefront && protectedPrefixes.some((p) => request.nextUrl.pathname.startsWith(p))

  if (
    // if the user is not logged in and a protected app path is accessed, redirect to the login page
    isProtected &&
    !user
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // Signed in but hasn't agreed to the current Terms and Conditions / Privacy Policy (Google
  // sign-ins, older accounts, or the terms changed): ask once before using the app.
  // The token's metadata can be a little stale right after they agree, so a "no" is confirmed
  // with the Auth server before redirecting (only ever costs a request for those users).
  if (
    user && (isProtected || request.nextUrl.pathname === '/') && !hasAcceptedTerms(user.user_metadata) &&
    !hasAcceptedTerms((await supabase.auth.getUser()).data.user?.user_metadata)
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/accept-terms'
    url.search = ''
    url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search)
    const redirect = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  // Plain user accounts shop, and so do verified students / faculty / staff who are members of a
  // store dashboard (lib/member-shopping.ts). Other dashboard accounts (Verification Admin, BAO, store
  // logins that aren't a verified university member) manage and sell: buyer pages send them back.
  //  • BAO → its view-only marketplace (/bao/browse, /bao/sellers/{id})
  //  • Seller → the matching Seller Dashboard page
  //  • others → their dashboard; settings/account → the shared My Account page (/account)
  // Storefronts (/seller/{id}) stay open to non-BAO dashboards as a read-only preview.
  const path = request.nextUrl.pathname
  if (user && (path.startsWith('/marketplace') || isPublicStorefront)) {
    // Which dashboard (if any) this person manages. Looked up once and remembered for 5 minutes in a
    // cookie tied to their account, so ordinary page-to-page browsing doesn't query the database here.
    const KNOWN = ['verification', 'bao', 'supply_office', 'cashier', 'seller']
    const cached = request.cookies.get('um_dash')?.value
    let primaryModule: string | undefined
    if (cached && cached.startsWith(user.id + ':') && [...KNOWN, '-'].includes(cached.slice(user.id.length + 1))) {
      const value = cached.slice(user.id.length + 1)
      primaryModule = value === '-' ? undefined : value
    } else {
      const [{ data: rows }, { data: profile }] = await Promise.all([
        supabase.from('dashboard_members').select('dashboards(module)').eq('user_id', user.id),
        supabase.from('profiles').select('is_identity_verified, affiliation').eq('id', user.id).maybeSingle(),
      ])
      const modules = new Set(
        (rows ?? []).flatMap((r: { dashboards: { module: string } | { module: string }[] | null }) =>
          (Array.isArray(r.dashboards) ? r.dashboards : r.dashboards ? [r.dashboards] : []).map((d) => d.module)),
      )
      // Verified students / faculty / staff on store dashboards also shop: no redirect for them.
      // Otherwise the first dashboard, in the same order as DASHBOARD_PRIORITY in lib/modules.ts.
      primaryModule = canShopAsMember(profile, [...modules]) ? undefined : KNOWN.find((m) => modules.has(m))
      supabaseResponse.cookies.set('um_dash', `${user.id}:${primaryModule ?? '-'}`, {
        maxAge: 300, path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
      })
    }
    const redirectTo = (pathname: string) => {
      const url = request.nextUrl.clone()
      url.pathname = pathname
      url.search = ''
      const redirect = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
      return redirect
    }
    const primary = primaryModule

    if (primary === 'bao') {
      const product = path.match(/^\/marketplace\/product\/([^/]+)/)
      const storefront = path.match(/^\/seller\/([0-9a-f-]{36})/i)
      return redirectTo(product ? `/bao/browse/${product[1]}` : storefront ? `/bao/sellers/${storefront[1]}` : '/bao/browse')
    }
    if (primary && path.startsWith('/marketplace')) {
      if (path.startsWith('/marketplace/settings') || path.startsWith('/marketplace/account')) return redirectTo('/account')
      if (primary === 'seller') {
        return redirectTo(
          path.startsWith('/marketplace/messages') ? '/seller/messages'
          : path.startsWith('/marketplace/product') ? '/seller/products'
          : '/seller',
        )
      }
      const home = { verification: '/admin', supply_office: '/supply-office', cashier: '/cashier' }[primary]
      return redirectTo(home ?? '/')
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
