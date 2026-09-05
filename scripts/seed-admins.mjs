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
  // ── Admin ──────────────────────────────────────────────────────────────────
  {
    email: "admin@unimerch.sorsu.edu.ph",
    role: "admin",
    full_name: "System Administrator",
    affiliation: "staff",
  },
  // ── BAO ────────────────────────────────────────────────────────────────────
  {
    email: "bao@unimerch.sorsu.edu.ph",
    role: "bao",
    full_name: "BAO Officer",
    affiliation: "staff",
  },
  // ── Registrar ──────────────────────────────────────────────────────────────
  {
    email: "registrar@unimerch.sorsu.edu.ph",
    role: "registrar",
    full_name: "Registrar Officer",
    affiliation: "staff",
  },
  // ── Supply Office ──────────────────────────────────────────────────────────
  {
    email: "supply@unimerch.sorsu.edu.ph",
    role: "supply_office",
    full_name: "Supply Office Staff",
    affiliation: "staff",
  },
  // ── Cashier (uses seller role with cashier context) ────────────────────────
  {
    email: "cashier@unimerch.sorsu.edu.ph",
    role: "seller",
    full_name: "University Cashier",
    affiliation: "staff",
  },
  // ── Seller (student org) ───────────────────────────────────────────────────
  {
    email: "seller@unimerch.sorsu.edu.ph",
    role: "seller",
    full_name: "CICT Student Council",
    affiliation: "student",
  },
  // ── Buyer ──────────────────────────────────────────────────────────────────
  {
    email: "buyer@unimerch.sorsu.edu.ph",
    role: "buyer",
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
    role: acct.role,
    affiliation: acct.affiliation,
    is_identity_verified: true,
    verification_status: "approved",
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
        role: acct.role,
        affiliation: acct.affiliation,
        is_identity_verified: true,
        verification_status: "approved",
      },
      { onConflict: "id" },
    )
  if (profileErr) {
    console.error(`[seed] profile upsert error for ${acct.email}:`, profileErr.message)
  } else {
    console.log(`[seed]   -> role = "${acct.role}"`)
  }
}

console.log("\n[seed] ✅  All accounts ready. Password for all: " + PASSWORD)
console.log("[seed] Accounts:")
for (const a of accounts) {
  console.log(`[seed]   ${a.role.padEnd(14)}  ${a.email}`)
}
