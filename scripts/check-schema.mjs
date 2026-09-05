import { readFileSync } from "node:fs"

// Load .env.local manually
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
)

const url = env.SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
const headers = { apikey: key, Authorization: `Bearer ${key}` }

const res = await fetch(`${url}/rest/v1/`, { headers })
if (!res.ok) {
  console.error("Failed to fetch schema:", res.status, await res.text())
  process.exit(1)
}
const spec = await res.json()

console.log("ALL TABLES EXPOSED VIA API:")
for (const [table, def] of Object.entries(spec.definitions ?? {})) {
  console.log(`\n${table}: ${Object.keys(def.properties).join(", ")}`)
}

// Probe seller_profiles directly
console.log("\n\nPROBE seller_profiles:")
const probe = await fetch(`${url}/rest/v1/seller_profiles?select=*&limit=1`, { headers })
console.log("status:", probe.status)
console.log(await probe.text())