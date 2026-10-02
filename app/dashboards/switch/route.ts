import { NextResponse, type NextRequest } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { activeDashboardCookie, getMemberships } from "@/lib/dashboards"
import { MODULES, MULTI_INSTANCE } from "@/lib/modules"

/** Switch the active dashboard (used when a user manages more than one organization). */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL("/auth/login", request.url))

  const memberships = await getMemberships(supabase, user.id)
  const target = memberships.find((m) => m.id === id)
  if (!target) return NextResponse.redirect(new URL("/marketplace", request.url))

  if (MULTI_INSTANCE.includes(target.module)) {
    ;(await cookies()).set(activeDashboardCookie(target.module), target.id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 })
  }
  // Optional deep link inside the same dashboard (e.g. ?next=/seller/shop)
  const base = MODULES[target.module].basePath
  const next = request.nextUrl.searchParams.get("next")
  const dest = next && (next === base || next.startsWith(base + "/")) ? next : base
  return NextResponse.redirect(new URL(dest, request.url))
}
