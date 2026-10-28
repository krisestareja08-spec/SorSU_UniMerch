import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink, FileText, MessageCircle } from "lucide-react"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { BackLink } from "@/components/navigation/history-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SupplyRequestList } from "@/components/store/supply-request-list"
import { SupplyRequestForm } from "@/components/store/supply-request-form"
import { SupplyRequestChat } from "@/components/store/supply-request-chat"
import { MainPanel, RequesterPanel } from "@/components/store/supply-request-panels"
import { collabProducts, getSupplyRequest, listSupplyRequests, mainCatalog } from "@/lib/supply-requests"
import { ITEM_KIND_LABEL, SUPPLY_STATUS, pesoFmt, requestCode, type SupplyRequest } from "@/lib/supply-request-shape"
import { getGlobalRoyaltyPercentage } from "@/lib/bao-settings"
import { MODULES, type DashboardCtx } from "@/lib/modules"
import { cn } from "@/lib/utils"

const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
const Notice = ({ message }: { message: string }) => <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{message}</p>

/** Organization / branch: its supply requests to the Main Supply Office. */
export async function SupplyRequestsPage({ ctx }: { ctx: DashboardCtx }) {
  const base = MODULES[ctx.module].basePath
  const { requests, error } = await listSupplyRequests(ctx.storeId ?? "")
  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Supply Requests"
        description={`Order from the Main Supply Office: big orders for events, modified items, new designs like uniforms${ctx.module === "seller" ? ", and stock for your collaboration products" : ""}. They review it, send a quote (with royalty), and deliver or have it ready for pick-up once paid.`} />
      {error ? <Notice message={error} /> : <SupplyRequestList requests={requests} mode="requester" hrefBase={`${base}/supply-requests`} newHref={`${base}/supply-requests/new`} />}
    </ManagementShell>
  )
}

/** New request, or editing one that's waiting / sent back for changes. */
export async function SupplyRequestFormPage({ ctx, requestId }: { ctx: DashboardCtx; requestId?: string }) {
  const base = MODULES[ctx.module].basePath
  const [catalog, collab, existing] = await Promise.all([
    mainCatalog(),
    ctx.module === "seller" ? collabProducts(ctx.storeId ?? "") : Promise.resolve([]),
    requestId ? getSupplyRequest(requestId) : Promise.resolve({ request: null, error: null }),
  ])
  if (requestId && !existing.error && (!existing.request || existing.request.requester_store_id !== ctx.storeId)) notFound()
  const editable = !existing.request || ["submitted", "changes_requested"].includes(existing.request.status)
  return (
    <ManagementShell ctx={ctx}>
      <BackLink href={existing.request ? `${base}/supply-requests/${existing.request.id}` : `${base}/supply-requests`} className="mb-3" />
      <PageHeading title={existing.request ? `Edit: ${existing.request.title}` : "New supply request"}
        description="Tell the Main Supply Office what you need. You can chat with them about it once it's sent." />
      {existing.error ? <Notice message={existing.error} />
        : !editable ? <Notice message="This request can't be edited any more — message the Main Supply Office instead." />
        : <SupplyRequestForm module={ctx.module} storeId={ctx.storeId ?? ""} basePath={base} catalog={catalog} collab={collab} initial={existing.request ?? undefined} />}
    </ManagementShell>
  )
}

/** Main Supply Office: every special order from organizations and branches. */
export async function SpecialOrdersPage({ ctx }: { ctx: DashboardCtx }) {
  const { requests, error } = await listSupplyRequests()
  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Special Orders"
        description="Supply requests from organizations and Supply Office branches: big event orders, modified items, new designs and collaboration stock. Review them, send a quote with the royalty, confirm payment, then deliver or have them picked up." />
      {error ? <Notice message={error} /> : <SupplyRequestList requests={requests} mode="main" hrefBase="/supply-office/special-orders" />}
    </ManagementShell>
  )
}

/** One request, for the requester or the Main office. */
export async function SupplyRequestDetailPage({ ctx, id }: { ctx: DashboardCtx; id: string }) {
  const asMain = ctx.module === "supply_office"
  const base = MODULES[ctx.module].basePath
  const listHref = asMain ? "/supply-office/special-orders" : `${base}/supply-requests`
  const [{ request: r, error }, rate] = await Promise.all([getSupplyRequest(id), asMain ? getGlobalRoyaltyPercentage() : Promise.resolve(0)])
  if (!error && (!r || (!asMain && r.requester_store_id !== ctx.storeId))) notFound()
  return (
    <ManagementShell ctx={ctx}>
      <BackLink href={listHref} className="mb-3" />
      {error || !r ? <Notice message={error ?? "Not found."} /> : <Detail r={r} ctx={ctx} asMain={asMain} rate={rate} />}
    </ManagementShell>
  )
}

function Detail({ r, ctx, asMain, rate }: { r: SupplyRequest; ctx: DashboardCtx; asMain: boolean; rate: number }) {
  const s = SUPPLY_STATUS[r.status]
  const images = r.attachments.filter((a) => a.kind === "image" && a.url)
  const docs = r.attachments.filter((a) => a.kind === "document")
  const quoted = r.total != null
  const drafts = [...new Set(r.items.map((i) => i.created_product_id).filter(Boolean))]
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{requestCode(r.id)} · {asMain ? r.requester_name : "To the Main Supply Office"} · sent {day(r.created_at)}</p>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">{r.title}</h1>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", s.tone)}>{s.label}</span>
      </div>
      <p className="rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm">
        {asMain ? s.mainHint : s.requesterHint}
        {r.main_note && <span className="mt-1 block text-xs"><span className="font-semibold">{asMain ? "Your note" : "Main Supply Office"}:</span> {r.main_note}</span>}
      </p>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="font-serif text-base">Items</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-120 text-sm">
                <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Item</th><th className="py-2 pr-3 text-right font-medium">Qty</th>
                  <th className="py-2 pr-3 text-right font-medium">Unit price</th><th className="py-2 text-right font-medium">Line total</th></tr></thead>
                <tbody>
                  {r.items.map((i) => (
                    <tr key={i.id} className="border-b border-border/60 align-top last:border-0">
                      <td className="py-2 pr-3">
                        <p className="font-medium">{i.name}{i.size ? ` (${i.size})` : ""}</p>
                        <p className="text-xs text-muted-foreground">{ITEM_KIND_LABEL[i.kind]}{i.uses_logo ? " · official logo" : ""}{i.list_on_marketplace ? " · to sell on the marketplace" : ""}</p>
                        {i.notes && <p className="mt-0.5 whitespace-pre-line text-xs">{i.notes}</p>}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{i.quantity}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{pesoFmt(i.unit_price)}{quoted && i.royalty_amount > 0 && <span className="block text-[11px] text-muted-foreground">+ {pesoFmt(i.royalty_amount)} royalty</span>}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{i.unit_price == null ? "—" : pesoFmt(i.unit_price * i.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {quoted && (
                <dl className="mt-3 space-y-0.5 border-t border-border pt-3 text-sm">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Items</dt><dd className="tabular-nums">{pesoFmt(r.items_total)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Royalty{r.royalty_percentage != null ? ` (${Number(r.royalty_percentage)}% of logo items × units)` : ""}</dt><dd className="tabular-nums">{pesoFmt(r.royalty_total)}</dd></div>
                  {r.delivery_fee > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd className="tabular-nums">{pesoFmt(r.delivery_fee)}</dd></div>}
                  <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd className="tabular-nums text-gold">{pesoFmt(r.total)}</dd></div>
                </dl>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-serif text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {r.description && <p className="whitespace-pre-line">{r.description}</p>}
              <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                <div><dt className="text-xs text-muted-foreground">Needed by</dt><dd>{r.needed_by ? day(r.needed_by) : "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">{r.fulfilment === "delivery" ? "Delivery" : "Pick-up"}</dt>
                  <dd>{r.fulfilment === "delivery" ? r.delivery_address : "Walk-in at the Main Supply Office"}{r.scheduled_date ? ` · ${day(r.scheduled_date)}` : ""}</dd></div>
                {r.paid_at && <div><dt className="text-xs text-muted-foreground">Paid</dt><dd>{day(r.paid_at)} · {r.payment_method === "cash" ? "cash" : r.payment_method}</dd></div>}
                {r.completed_at && <div><dt className="text-xs text-muted-foreground">Completed</dt><dd>{day(r.completed_at)}</dd></div>}
              </dl>
              {r.link_url && <a href={r.link_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><ExternalLink className="size-3.5" />{r.link_url.replace(/^https?:\/\//, "").slice(0, 60)}</a>}
              {images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {images.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block size-24 overflow-hidden rounded-lg border border-border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.url} alt={a.name} className="size-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
              {docs.length > 0 && (
                <ul className="space-y-1">
                  {docs.map((a, i) => (
                    <li key={i}>{a.signedUrl
                      ? <a href={a.signedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"><FileText className="size-4" />{a.name}</a>
                      : <span className="inline-flex items-center gap-1.5 text-muted-foreground"><FileText className="size-4" />{a.name}</span>}</li>
                  ))}
                </ul>
              )}
              {!r.description && !r.link_url && r.attachments.length === 0 && <p className="text-muted-foreground">No description or files.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {asMain ? <MainPanel request={r} royaltyRate={rate} /> : <RequesterPanel request={r} module={ctx.module} basePath={MODULES[ctx.module].basePath} storeId={ctx.storeId ?? ""} />}
          {!asMain && drafts.length > 0 && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/5 dark:text-emerald-200">
              {drafts.length} product draft{drafts.length === 1 ? " was" : "s were"} added to your Products with the delivered stock.{" "}
              <Link href={`${MODULES[ctx.module].basePath}/products`} className="font-semibold underline">Set the price and submit for review</Link>
            </p>
          )}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 font-serif text-base"><MessageCircle className="size-4 text-primary" />Chat with {asMain ? r.requester_name : "the Main Supply Office"}</CardTitle></CardHeader>
            <CardContent><SupplyRequestChat requestId={r.id} asMain={asMain} otherParty={asMain ? r.requester_name : "Main Supply Office"} /></CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
