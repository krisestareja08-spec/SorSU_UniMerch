import Link from "next/link"
import { notFound } from "next/navigation"
import { Banknote, BellRing, CalendarDays, Check, CheckCircle2, Clock, ExternalLink, FileText, MessageCircle, PackageCheck, Store, Truck, XCircle } from "lucide-react"
import { ManagementShell } from "@/components/management/management-shell"
import { Callout, PageHeading } from "@/components/management/dashboard-ui"
import { BackLink } from "@/components/navigation/history-nav"
import { ProductThumb } from "@/components/ui/product-thumb"
import { SupplyRequestList } from "@/components/store/supply-request-list"
import { SupplyRequestForm } from "@/components/store/supply-request-form"
import { SupplyRequestChat } from "@/components/store/supply-request-chat"
import { MainPanel, RequesterPanel } from "@/components/store/supply-request-panels"
import { collabProducts, getSupplyRequest, listSupplyRequests, mainCatalog } from "@/lib/supply-requests"
import { ITEM_KIND_LABEL, SUPPLY_STATUS, pesoFmt, requestCode, type SupplyItem, type SupplyRequest, type SupplyStatus } from "@/lib/supply-request-shape"
import { getGlobalRoyaltyPercentage } from "@/lib/bao-settings"
import { MODULES, type DashboardCtx } from "@/lib/modules"
import { cn } from "@/lib/utils"

const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
const Notice = ({ message }: { message: string }) => <div className="mt-5"><Callout tone="warn">{message}</Callout></div>

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

const REACHED: Record<SupplyStatus, number> = {
  submitted: 0, changes_requested: 0, approved: 1, payment_review: 1, paid: 2, preparing: 3, ready: 4, out_for_delivery: 4, completed: 5, declined: -1, cancelled: -1,
}

/** Where the request is: Sent → Quoted → Paid → Preparing → Ready / On the way → Done */
function Progress({ r }: { r: SupplyRequest }) {
  const reached = REACHED[r.status]
  if (reached < 0) return null
  const steps = ["Sent", "Quoted", "Paid", "Preparing", r.fulfilment === "delivery" ? "On the way" : "Ready", "Done"]
  return (
    <ol aria-label="Progress" className="flex items-start rounded-2xl border border-border bg-card px-2 py-3 sm:px-4">
      {steps.map((label, i) => {
        const done = i <= reached
        const current = i === reached + 1
        return (
          <li key={label} aria-current={current ? "step" : undefined} className="relative flex flex-1 flex-col items-center gap-1 text-center">
            {i > 0 && <span aria-hidden className={cn("absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2", done ? "bg-primary" : "bg-border")} />}
            <span className={cn("relative z-10 flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold",
              done ? "border-primary bg-primary text-primary-foreground" : current ? "border-gold bg-card text-foreground" : "border-border bg-card text-muted-foreground")}>
              {done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn("text-[11px] leading-tight sm:text-xs", done || current ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** The request's lines grouped per item (its sizes together), so each item shows once with its photo. */
function groupItems(items: SupplyItem[]) {
  const groups = new Map<string, SupplyItem[]>()
  for (const i of items) groups.set(i.design_group ?? i.id, [...(groups.get(i.design_group ?? i.id) ?? []), i])
  return [...groups.values()]
}

function Detail({ r, ctx, asMain, rate }: { r: SupplyRequest; ctx: DashboardCtx; asMain: boolean; rate: number }) {
  const s = SUPPLY_STATUS[r.status]
  const images = r.attachments.filter((a) => a.kind === "image" && a.url)
  const docs = r.attachments.filter((a) => a.kind === "document")
  const quoted = r.total != null
  const drafts = [...new Set(r.items.map((i) => i.created_product_id).filter(Boolean))]
  const units = r.items.reduce((n, i) => n + i.quantity, 0)
  const yourTurn = (asMain ? ["submitted", "payment_review", "paid", "preparing", "ready", "out_for_delivery"] : ["changes_requested", "approved", "ready"]).includes(r.status)
  const closed = r.status === "declined" || r.status === "cancelled"
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-semibold tracking-tight">{r.title}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className="font-mono">{requestCode(r.id)}</span> · {asMain ? <span className="font-medium text-foreground/80">{r.requester_name}</span> : "To the Main Supply Office"} · sent {day(r.created_at)}
          </p>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", s.tone)}>{s.label}</span>
      </header>

      <Progress r={r} />
      <Callout icon={closed ? XCircle : r.status === "completed" ? CheckCircle2 : yourTurn ? BellRing : Clock}
        tone={closed ? "warn" : r.status === "completed" ? "success" : yourTurn ? "warn" : "info"}>
        <p className="font-semibold">{yourTurn ? "Your turn: " : ""}{asMain ? s.mainHint : s.requesterHint}</p>
        {r.main_note && <p className="mt-0.5 text-xs"><span className="font-semibold">{asMain ? "Your note" : "Main Supply Office"}:</span> {r.main_note}</p>}
      </Callout>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:items-start">
        {/* What to do now: first on phones, top right on desktops */}
        <div className="space-y-4 empty:hidden lg:col-start-2 lg:row-start-1">
          {asMain ? <MainPanel request={r} royaltyRate={rate} /> : <RequesterPanel request={r} module={ctx.module} basePath={MODULES[ctx.module].basePath} storeId={ctx.storeId ?? ""} />}
          {!asMain && drafts.length > 0 && (
            <Callout tone="success" icon={PackageCheck}>
              {drafts.length} product draft{drafts.length === 1 ? " was" : "s were"} added to your Products with the delivered stock.{" "}
              <Link href={`${MODULES[ctx.module].basePath}/products`} className="font-semibold underline">Set the price and submit for review</Link>
            </Callout>
          )}
        </div>

        <div className="space-y-4 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h2 className="mb-3 flex items-baseline justify-between gap-2 font-serif text-base font-semibold">
              Items <span className="font-sans text-xs font-normal text-muted-foreground">{units} unit{units === 1 ? "" : "s"}</span>
            </h2>
            <ul className="space-y-2">
              {groupItems(r.items).map((lines) => {
                const first = lines[0]
                return (
                  <li key={first.id} className="flex gap-3 rounded-xl border border-border p-3">
                    <ProductThumb src={first.image_url ?? (first.kind === "custom" ? images[0]?.url : null)} alt={first.name} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{first.name}</p>
                      <p className="text-xs text-muted-foreground">{ITEM_KIND_LABEL[first.kind]}{first.uses_logo ? " · official logo" : ""}{first.list_on_marketplace ? " · to sell on the marketplace" : ""}</p>
                      {first.notes && <p className="mt-1 whitespace-pre-line rounded-lg bg-muted/50 px-2 py-1 text-xs">{first.notes}</p>}
                      <ul className="mt-2 divide-y divide-border/60 text-sm">
                        {lines.map((i) => (
                          <li key={i.id} className="py-1.5">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="whitespace-nowrap"><span className="font-medium">{i.size || "One size"}</span> <span className="text-muted-foreground">× {i.quantity}</span></span>
                              {i.unit_price != null && <span className="font-semibold tabular-nums">{pesoFmt(i.unit_price * i.quantity)}</span>}
                            </div>
                            {i.unit_price != null && (
                              <p className="text-[11px] text-muted-foreground tabular-nums">{pesoFmt(i.unit_price)} per unit{quoted && i.royalty_amount > 0 ? ` + ${pesoFmt(i.royalty_amount)} royalty each` : ""}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                )
              })}
            </ul>
            {quoted ? (
              <dl className="mt-3 space-y-0.5 rounded-xl bg-muted/40 px-3 py-2.5 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Items</dt><dd className="tabular-nums">{pesoFmt(r.items_total)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Royalty{r.royalty_percentage != null ? ` (${Number(r.royalty_percentage)}% of logo items × units)` : ""}</dt><dd className="tabular-nums">{pesoFmt(r.royalty_total)}</dd></div>
                {r.delivery_fee > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd className="tabular-nums">{pesoFmt(r.delivery_fee)}</dd></div>}
                <div className="flex justify-between border-t border-border pt-1 text-base font-bold"><dt>Total</dt><dd className="tabular-nums text-gold">{pesoFmt(r.total)}</dd></div>
              </dl>
            ) : <p className="mt-3 text-xs text-muted-foreground">Prices and the royalty are set in the Main Supply Office&apos;s quote.</p>}
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 text-sm sm:p-5">
            <h2 className="mb-3 font-serif text-base font-semibold">Details</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="flex gap-2.5"><CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><dt className="text-xs text-muted-foreground">Needed by</dt><dd>{r.needed_by ? day(r.needed_by) : "No date given"}</dd></div></div>
              <div className="flex gap-2.5">{r.fulfilment === "delivery" ? <Truck className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> : <Store className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                <div><dt className="text-xs text-muted-foreground">{r.fulfilment === "delivery" ? "Delivery" : "Pick-up"}</dt>
                  <dd>{r.fulfilment === "delivery" ? r.delivery_address : "Walk-in at the Main Supply Office"}{r.scheduled_date ? ` · ${day(r.scheduled_date)}` : ""}</dd></div></div>
              {r.paid_at && <div className="flex gap-2.5"><Banknote className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><dt className="text-xs text-muted-foreground">Paid</dt><dd>{day(r.paid_at)} · {r.payment_method === "cash" ? "cash" : r.payment_method}</dd></div></div>}
              {r.completed_at && <div className="flex gap-2.5"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><dt className="text-xs text-muted-foreground">Completed</dt><dd>{day(r.completed_at)}</dd></div></div>}
            </dl>
            {r.description && <p className="mt-4 whitespace-pre-line border-t border-border pt-3">{r.description}</p>}
            {(images.length > 0 || docs.length > 0 || r.link_url) && (
              <div className="mt-4 space-y-2 border-t border-border pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Design files</p>
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
                {r.link_url && <a href={r.link_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><ExternalLink className="size-3.5" />{r.link_url.replace(/^https?:\/\//, "").slice(0, 60)}</a>}
              </div>
            )}
          </section>
        </div>

        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 lg:col-start-2 lg:row-start-2">
          <h2 className="mb-3 flex items-center gap-2 font-serif text-base font-semibold"><MessageCircle className="size-4 text-primary" />Chat with {asMain ? r.requester_name : "the Main Supply Office"}</h2>
          <SupplyRequestChat requestId={r.id} asMain={asMain} otherParty={asMain ? r.requester_name : "Main Supply Office"} />
        </section>
      </div>
    </div>
  )
}
