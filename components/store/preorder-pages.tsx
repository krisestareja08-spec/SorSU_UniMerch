import { notFound } from "next/navigation"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { BackLink } from "@/components/navigation/history-nav"
import { PreorderFormsIndex } from "@/components/store/preorder-forms-index"
import { formKey } from "@/lib/preorder-key"
import { PreorderFormView } from "@/components/store/preorder-form-view"
import { loadPreorderRecords, summarizeForms } from "@/lib/preorder-forms"
import { MODULES, type DashboardCtx } from "@/lib/modules"

function SetupNotice({ message }: { message: string }) {
  return <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{message}</p>
}

/** List of pre-order completion forms — one per pre-ordered product. */
export async function PreorderFormsPage({ ctx }: { ctx: DashboardCtx }) {
  const { records, error } = await loadPreorderRecords(ctx.storeId ?? "")
  const forms = error ? [] : await summarizeForms(records, ctx.storeId ?? "")
  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Pre-order Forms"
        description="One form per pre-ordered product, listing every buyer whose pre-order is purchased and/or claimed. Search a product or a buyer to find a record." />
      {error ? <SetupNotice message={error} /> : <PreorderFormsIndex forms={forms} records={records} basePath={MODULES[ctx.module].basePath} />}
    </ManagementShell>
  )
}

/** One product's form. `formId` is the product id (or the name, for a product that was deleted). */
export async function PreorderFormPage({ ctx, formId, query }: { ctx: DashboardCtx; formId: string; query?: string }) {
  const { records, error } = await loadPreorderRecords(ctx.storeId ?? "")
  const key = decodeURIComponent(formId)
  const mine = records.filter((r) => formKey(r) === formId || formKey(r) === key)
  if (!error && mine.length === 0) notFound()
  const base = MODULES[ctx.module].basePath
  return (
    <ManagementShell ctx={ctx}>
      <div className="print:hidden"><BackLink href={`${base}/preorders`} className="mb-3" /></div>
      <PageHeading title={mine[0]?.productName ?? "Pre-order Form"} description="Pre-order completion form: who bought, what size, how much was paid, and whether it's been claimed." />
      {error
        ? <SetupNotice message={error} />
        : <PreorderFormView productName={mine[0].productName} storeName={ctx.dashboardName} records={mine} initialQuery={query} />}
    </ManagementShell>
  )
}
