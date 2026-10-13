import { requireDashboard } from "@/lib/dashboards"
import { PreorderFormPage } from "@/components/store/preorder-pages"

export default async function Page({ params, searchParams }: { params: Promise<{ form: string }>; searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireDashboard("seller", "orders")
  const [{ form }, { q }] = await Promise.all([params, searchParams])
  return <PreorderFormPage ctx={ctx} formId={form} query={q} />
}
