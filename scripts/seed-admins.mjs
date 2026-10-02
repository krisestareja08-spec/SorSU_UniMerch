import { createClient } from "@supabase/supabase-js"

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error("[seed] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PASSWORD = "UniMerch2025!"

const accounts = [
  // ── Verification Admin (Main Admin of the Verification Admin dashboard) ─────
  // Accounts are plain users; dashboards are modules they are assigned to.
  {
    email: "admin@unimerch.sorsu.edu.ph",
    dashboard: "verification",
    full_name: "Verification Admin",
    affiliation: "staff",
  },
  // ── BAO (Business Affairs Office) — Main Admin of the BAO dashboard ─────────
  {
    email: "bao@unimerch.sorsu.edu.ph",
    dashboard: "bao",
    full_name: "BAO Officer",
    affiliation: "staff",
  },
  // ── Supply Office ──────────────────────────────────────────────────────────
  {
    email: "supply@unimerch.sorsu.edu.ph",
    dashboard: "supply_office",
    full_name: "Supply Office Staff",
    affiliation: "staff",
  },
  // ── Cashier ────────────────────────────────────────────────────────────────
  {
    email: "cashier@unimerch.sorsu.edu.ph",
    dashboard: "cashier",
    full_name: "University Cashier",
    affiliation: "staff",
  },
  // ── Seller organization (gets its own store + Seller Dashboard) ────────────
  {
    email: "seller@unimerch.sorsu.edu.ph",
    dashboard: "seller",
    organization: "CICT Student Council",
    full_name: "Maria Santos",
    affiliation: "student",
  },
  // ── Buyer (regular user — no dashboard) ────────────────────────────────────
  {
    email: "buyer@unimerch.sorsu.edu.ph",
    dashboard: null,
    full_name: "Juan Dela Cruz",
    affiliation: "student",
  },
] 

// ── List existing users once (avoid N calls) ─────────────────────────────────
const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (listErr) { console.error("[seed] listUsers error:", listErr.message); process.exit(1) }

for (const acct of accounts) {
  const existing = list.users.find((u) => u.email === acct.email)
  let userId = null

  const metadata = {
    full_name: acct.full_name,
    affiliation: acct.affiliation,
  }

  if (existing) {
    userId = existing.id
    await admin.auth.admin.updateUserById(userId, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: metadata,
    })
    console.log(`[seed] Updated: ${acct.email}`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: acct.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: metadata,
    })
    if (error) { console.error(`[seed] createUser error for ${acct.email}:`, error.message); continue }
    userId = data.user.id
    console.log(`[seed] Created: ${acct.email}`)
  }

  // Upsert profile row
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        full_name: acct.full_name,
        role: "buyer",
        affiliation: acct.affiliation,
        // Staff accounts are verified; the demo buyer goes through the real verification flow.
        is_identity_verified: acct.dashboard !== null,
        verification_status: acct.dashboard !== null ? "approved" : "unverified",
      },
      { onConflict: "id" },
    )
  if (profileErr) {
    console.error(`[seed] profile upsert error for ${acct.email}:`, profileErr.message)
  }

  if (!acct.dashboard) continue // regular user

  // Make the account Main Admin of its dashboard (requires scripts/setup_all.sql).
  let dash = null
  if (acct.dashboard === "seller") {
    // Each organization has its own store + Seller Dashboard
    const { data: existingDash } = await admin.from("dashboards").select("id").eq("module", "seller").eq("name", acct.organization).maybeSingle()
    dash = existingDash
    if (!dash) {
      const { data: store, error: storeErr } = await admin.from("seller_profiles")
        .insert({ org_name: acct.organization, status: "active", category: "Student Organization" }).select("id").single()
      if (storeErr) { console.error(`[seed] store error for ${acct.organization}:`, storeErr.message); continue }
      const { data: created, error: createErr } = await admin.from("dashboards")
        .insert({ module: "seller", name: acct.organization, store_id: store.id }).select("id").single()
      if (createErr) { console.error(`[seed] dashboard error for ${acct.organization}:`, createErr.message); continue }
      dash = created
    }
  } else {
    // Cashier has one dashboard per campus branch — the seeded cashier runs the Bulan Campus branch.
    let lookup = admin.from("dashboards").select("id").eq("module", acct.dashboard)
    if (acct.dashboard === "cashier") lookup = lookup.eq("name", "Cashier — Bulan Campus")
    const { data: found, error: dashErr } = await lookup.limit(1).maybeSingle()
    if (dashErr || !found) {
      console.error(`[seed] dashboard "${acct.dashboard}" not found — run scripts/setup_all.sql first.`)
      continue
    }
    dash = found
  }
  await admin.from("dashboard_members").update({ is_main: false }).eq("dashboard_id", dash.id).eq("is_main", true).neq("user_id", userId)
  const { error: memberErr } = await admin
    .from("dashboard_members")
    .upsert({ dashboard_id: dash.id, user_id: userId, is_main: true }, { onConflict: "dashboard_id,user_id" })
  if (memberErr) console.error(`[seed] membership error for ${acct.email}:`, memberErr.message)
  else console.log(`[seed]   -> Main Admin of "${acct.dashboard}" dashboard`)
}

console.log("\n[seed] ✅  All accounts ready. Password for all: " + PASSWORD)
console.log("[seed] Accounts:")
for (const a of accounts) {
  console.log(`[seed]   ${(a.organization ?? a.dashboard ?? "user").padEnd(22)}  ${a.email}`)
}
