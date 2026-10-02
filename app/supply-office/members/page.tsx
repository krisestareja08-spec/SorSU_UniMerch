import { requireDashboard } from "@/lib/dashboards"
import { MembersPage } from "@/components/management/members-page"

export default async function Page() {
  const ctx = await requireDashboard("supply_office", "members")
  return <MembersPage ctx={ctx} />
}
