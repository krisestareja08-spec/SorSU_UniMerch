import { notFound } from "next/navigation"
import { ManagementShell } from "@/components/management/management-shell"
import { Callout, PageHeading } from "@/components/management/dashboard-ui"
import { BackLink } from "@/components/navigation/history-nav"
import { PreorderFormsIndex, type FormRecord, type FormSummary } from "@/components/store/preorder-forms-index"
import { PreorderFormView } from "@/components/store/preorder-form-view"
import { PreorderFormEditor, type PickableProduct } from "@/components/store/preorder-form-editor"
import { formRows, loadFormStock, loadForms, loadPurchases } from "@/lib/preorder-forms"
import { createClient } from "@/lib/supabase/server"
import { MODULES, type DashboardCtx } from "@/lib/modules"

function SetupNotice({ message }: { message: string }) {
  return <div className="mt-5"><Callout tone="warn">{message}</Callout></div>
}

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s)

/** The shop's pre-order forms (live waitlists), with Create form and a search across every record. */
export async function PreorderFormsPage({ ctx }: { ctx: DashboardCtx }) {
  const storeId = ctx.storeId ?? ""
  const [{ forms, error }, { purchases, error: purchaseError }, products] = await Promise.all([loadForms(storeId), loadPurchases(storeId), storeProducts(storeId)])
  const summaries: FormSummary[] = []
  const records: FormRecord[] = []
  const imageOf = new Map(products.map((p) => [p.id, p.image]))
  for (const f of forms) {
    const rows = formRows(f, purchases)
    summaries.push({
      id: f.id, title: f.title, products: f.columns.flatMap((c) => c.products.map((p) => p.name)),
      images: f.columns.flatMap((c) => c.products.map((p) => imageOf.get(p.id) ?? null)),
      records: rows.length, waiting: rows.filter((r) => r.stage === "waitlist").length,
      ready: rows.filter((r) => r.stage === "ready").length, claimed: rows.filter((r) => r.stage === "claimed").length,
      units: rows.reduce((n, r) => n + r.quantity, 0), amount: rows.reduce((n, r) => n + r.amountPaid, 0),
      updatedAt: rows.reduce((t, r) => [r.claimedAt, r.orderedAt].reduce<string>((m, d) => (d && d > m ? d : m), t), f.updatedAt),
    })
    for (const r of rows) {
      records.push({ key: r.key, formId: f.id, formTitle: f.title, buyerName: r.buyerName, course: r.course, contact: r.contact, sizes: Object.values(r.cells).join(", "), claimed: r.stage === "claimed", stage: r.stage })
    }
  }
  // Pre-order products no form covers yet (their buyers wouldn't be recorded anywhere)
  const inForms = new Set(forms.flatMap((f) => f.columns.flatMap((c) => c.products.map((p) => p.id))))
  const unassigned = [...new Set([
    ...products.filter((p) => p.preOrder && !inForms.has(p.id)).map((p) => p.name),
    ...purchases.flatMap((pu) => pu.lines.filter((l) => !l.productId || !inForms.has(l.productId)).map((l) => l.productName)),
  ])]
  const problem = error ?? purchaseError
  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Pre-order Forms"
        description="Your forms, like the paper pre-order sheets, and the live waitlist: buyers are listed in queue order once they pay half or in full. Mark them ready when their size arrives; picked-up orders move to History." />
      {problem ? <SetupNotice message={problem} /> : <PreorderFormsIndex forms={summaries} records={records} unassigned={unassigned} basePath={MODULES[ctx.module].basePath} />}
    </ManagementShell>
  )
}

/** One form as a table. */
export async function PreorderFormPage({ ctx, formId, query }: { ctx: DashboardCtx; formId: string; query?: string }) {
  if (!isUuid(formId)) notFound()
  const storeId = ctx.storeId ?? ""
  const [{ forms, error }, { purchases, error: purchaseError }] = await Promise.all([loadForms(storeId), loadPurchases(storeId)])
  const form = forms.find((f) => f.id === formId)
  if (!error && !form) notFound()
  const stock = form ? await loadFormStock(form.columns.flatMap((c) => c.products.map((p) => p.id))) : {}
  const base = MODULES[ctx.module].basePath
  const problem = error ?? purchaseError
  return (
    <ManagementShell ctx={ctx}>
      <div className="print:hidden"><BackLink href={`${base}/preorders`} className="mb-3" /></div>
      <PageHeading title={form?.title ?? "Pre-order Form"} description="Who pre-ordered which size, in queue order, how much they paid, and whether it's ready or picked up." />
      {problem || !form
        ? <SetupNotice message={problem ?? "Form not found."} />
        : <PreorderFormView form={form} storeName={ctx.dashboardName} rows={formRows(form, purchases)} stock={stock} module={ctx.module}
            editHref={`${base}/preorders/${form.id}/edit`} initialQuery={query} />}
    </ManagementShell>
  )
}

/** Create a form, or edit one (formId). */
export async function PreorderFormEditPage({ ctx, formId }: { ctx: DashboardCtx; formId?: string }) {
  if (formId && !isUuid(formId)) notFound()
  const storeId = ctx.storeId ?? ""
  const [{ forms, error }, products] = await Promise.all([formId ? loadForms(storeId) : Promise.resolve({ forms: [], error: null }), storeProducts(storeId)])
  const form = formId ? forms.find((f) => f.id === formId) : undefined
  if (formId && !error && !form) notFound()
  const base = MODULES[ctx.module].basePath
  return (
    <ManagementShell ctx={ctx}>
      <BackLink href={form ? `${base}/preorders/${form.id}` : `${base}/preorders`} className="mb-3" />
      <PageHeading title={form ? `Edit: ${form.title}` : "Create a pre-order form"}
        description="Name the form, then add Size / Qty cells and pick the products each one covers." />
      {error
        ? <SetupNotice message={error} />
        : <PreorderFormEditor module={ctx.module} basePath={base} products={products} initial={form} />}
    </ManagementShell>
  )
}

async function storeProducts(storeId: string): Promise<PickableProduct[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("products").select("id, name, badge, image_url").eq("seller_id", storeId).order("name").limit(1000)
  return (data ?? []).map((p) => ({ id: p.id as string, name: p.name as string, preOrder: p.badge === "Pre-Order", image: (p.image_url as string | null) ?? null }))
}
