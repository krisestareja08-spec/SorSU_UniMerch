"use client"

import Image from "next/image"
import Link from "next/link"
import { use, useState, useRef, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  MapPin,
  CreditCard,
  QrCode,
  Banknote,
  Building2,
  Upload,
  CheckCircle2,
  ChevronRight,
  Edit2,
  AlertCircle,
  Loader2,
  ShoppingBag,
  AlertTriangle,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { lineKey, useCart, type CartItem } from "@/lib/cart-context"
import { clearBuyNowItem, readBuyNowItem, shopKey } from "@/lib/buy-now"
import { PAYMENT_METHOD_MODE, PAYMENT_MODES, commonPaymentModes, parsePaymentModes, type PaymentMode } from "@/lib/product-pricing"
import { submitOrder } from "./actions"
import { validateFullName } from "@/lib/profile-rules"
import { CAMPUS_LABELS, type Campus } from "@/lib/roles"
import { unwrap } from "@/lib/action-result"

const BADGE_STYLES: Record<string, string> = {
  "Available":    "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300",
  "Pre-Order":    "bg-gold/15 text-amber-700 border border-gold/30 dark:text-gold",
  "Interest Check": "bg-primary/10 text-primary border border-primary/20",
}

const PAYMENT_METHODS = [
  { id: "gcash", label: "GCash (QR Code)", icon: QrCode,    recommended: true },
  { id: "cash",  label: "Cash (Walk-in)",  icon: Banknote },
  { id: "bank",  label: "Bank Transfer",   icon: Building2 },
]

export default function CheckoutPage({ searchParams }: { searchParams: Promise<{ buy?: string }> }) {
  const router = useRouter()
  const { items: cartItems, loaded: cartLoaded, removeItems } = useCart()
  // ?buy=1: "Buy" / "Buy Now" on one product — check out only that item, never the cart's
  const buyMode = use(searchParams).buy === "1"
  const [buyItem, setBuyItem] = useState<CartItem | null>(null)
  const [buyLoaded, setBuyLoaded] = useState(false)
  useEffect(() => {
    if (!buyMode) return
    setBuyItem(readBuyNowItem())
    setBuyLoaded(true)
  }, [buyMode])
  const loaded = buyMode ? buyLoaded : cartLoaded
  // Otherwise only the items ticked in the cart are checked out
  const items = useMemo(
    () => (buyMode ? (buyItem ? [buyItem] : []) : cartItems.filter((i) => i.selected !== false)),
    [buyMode, buyItem, cartItems],
  )
  // One shop per checkout, so the buyer pays one seller one amount
  const shopCount = new Set(items.map(shopKey)).size
  const hasPreOrder = items.some((i) => i.badge === "Pre-Order")
  // Pre-orders are checked out on their own: no upfront payment, an I.D. check and a pick-up date
  const mixedPreOrder = hasPreOrder && items.some((i) => i.badge !== "Pre-Order")
  const [paymentChoice, setPayment] = useState("gcash")
  // Each product says how it may be paid (walk-in at the counter, online, or both — scripts/27);
  // checkout offers only the methods every item allows. Pre-orders are paid at the counter on pick-up.
  const [productModes, setProductModes] = useState<Record<string, PaymentMode[]>>({})
  const productIdsKey = [...new Set(items.map((i) => i.id))].sort().join(",")
  useEffect(() => {
    if (!productIdsKey) return
    const supabase = createClient()
    supabase.from("products").select("id, payment_modes").in("id", productIdsKey.split(",")).then(({ data, error }) => {
      if (error) return // column not created yet: every method stays available
      setProductModes(Object.fromEntries((data ?? []).map((p) => [p.id, parsePaymentModes(p.payment_modes)])))
    })
  }, [productIdsKey])
  const allowedModes = commonPaymentModes(items.map((i) => productModes[i.id] ?? PAYMENT_MODES))
  const methodAllowed = (id: string) => (hasPreOrder ? id === "cash" : allowedModes.includes(PAYMENT_METHOD_MODE[id]))
  const availableMethods = PAYMENT_METHODS.filter((m) => methodAllowed(m.id))
  const payment = methodAllowed(paymentChoice) ? paymentChoice : availableMethods[0]?.id ?? "cash"
  const [preOrderStores, setPreOrderStores] = useState<{ id: string; name: string; storeHours: string | null; claimDays: number; location: string | null; penalty: number }[]>([])
  // Pre-order: the date the buyer will pick it up, and a photo of their I.D. for the shop to check
  const [pickupDate, setPickupDate] = useState("")
  const [idFile, setIdFile] = useState<File | null>(null)
  const [idPreview, setIdPreview] = useState<string | null>(null)
  const idRef = useRef<HTMLInputElement>(null)
  // Unpaid penalties with this checkout's shop block ordering from it (scripts/29)
  const [penaltyShops, setPenaltyShops] = useState<{ name: string; amount: number }[]>([])
  const [receipt, setReceipt] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)
  // Set once the order is placed so emptying the cart doesn't flash "Your cart is empty" before the redirect
  const [placed, setPlaced] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [buyer, setBuyer] = useState<{ full_name: string; student_employee_id: string; course: string; department: string; contact: string; campus: string; account_status: string } | null>(null)
  // Orders need a real name, a contact number and an account in good standing.
  const profileProblem = !buyer ? null
    : buyer.account_status === "suspended" || buyer.account_status === "banned" ? "Your account is restricted and can't place orders."
    : validateFullName(buyer.full_name) ?? (!buyer.contact ? "Add your contact number so the seller can reach you." : null)
  const [sellerQrs, setSellerQrs] = useState<{ sellerId: string; orgName: string; qrUrl: string }[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from("profiles")
        .select("full_name, student_employee_id, course, department, contact, campus, account_status")
        .eq("id", user.id)
        .maybeSingle()
      setBuyer({
        full_name: data?.full_name ?? "",
        student_employee_id: data?.student_employee_id ?? "",
        course: data?.course ?? "",
        department: data?.department ?? "",
        contact: data?.contact ?? "",
        campus: data?.campus ? CAMPUS_LABELS[data.campus as Campus] ?? data.campus : "",
        account_status: data?.account_status ?? "active",
      })
    })
  }, [])

  // Section 8 — checkout logic: only show a seller's QR when their qr_status is active.
  useEffect(() => {
    const sellerIds = [...new Set(items.map((i) => i.sellerId).filter((id): id is string => !!id))]
    const supabase = createClient()
    let query = supabase
      .from("seller_profiles")
      .select("id, org_name, gcash_qr_url, qr_status")
      .eq("qr_status", "active")
    if (sellerIds.length > 0) query = query.in("id", sellerIds)
    query.then(({ data }) => {
      const rows = sellerIds.length === 0 ? [] : (data ?? [])
      setSellerQrs(
        rows
          .filter((s) => !!s.gcash_qr_url)
          .map((s) => ({ sellerId: s.id, orgName: s.org_name, qrUrl: s.gcash_qr_url as string })),
      )
    })
  }, [items])

  useEffect(() => {
    const ids = [...new Set(items.filter((i) => i.badge === "Pre-Order" && i.sellerId).map((i) => i.sellerId as string))]
    if (ids.length === 0) return
    const supabase = createClient()
    type Row = { id: string; org_name: string | null; pickup_location?: string | null; store_hours?: string | null; claim_window_days?: number | null; preorder_penalty?: number | null }
    const load = async (columns: string) => (await supabase.from("seller_profiles").select(columns).in("id", ids)) as unknown as { data: Row[] | null; error: unknown }
    // store_hours / claim_window_days arrive with scripts/22, preorder_penalty with scripts/29
    load("id, org_name, pickup_location, store_hours, claim_window_days, preorder_penalty").then(async ({ data, error }) => {
      const rows = error ? (await load("id, org_name, pickup_location, store_hours, claim_window_days")).data ?? (await load("id, org_name")).data : data
      setPreOrderStores((rows ?? []).map((s) => ({
        id: s.id,
        name: s.org_name ?? "Campus Seller",
        storeHours: s.store_hours ?? null,
        claimDays: Math.min(7, Math.max(3, s.claim_window_days ?? 7)),
        location: s.pickup_location ?? null,
        penalty: Number(s.preorder_penalty ?? 10),
      })))
    })
  }, [items])

  useEffect(() => {
    const ids = [...new Set(items.map((i) => i.sellerId).filter((id): id is string => !!id))]
    if (ids.length === 0) return
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data, error } = await supabase.from("buyer_penalties").select("store_id, amount, seller_profiles(org_name)")
        .eq("buyer_id", user.id).in("status", ["unpaid", "pending_review"]).in("store_id", ids)
      if (error) return // table arrives with scripts/29
      setPenaltyShops((data ?? []).map((p) => {
        const shop = Array.isArray(p.seller_profiles) ? p.seller_profiles[0] : p.seller_profiles
        return { name: (shop as { org_name?: string } | null)?.org_name ?? "this shop", amount: Number(p.amount) }
      }))
    })
  }, [items])

  // Pick-up date: from tomorrow up to the shop's window (3–7 days after ordering)
  const preOrderShop = preOrderStores[0]
  const localDate = (offsetDays: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offsetDays)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }
  const minPickup = localDate(1)
  const maxPickup = localDate(preOrderShop?.claimDays ?? 7)
  const pickupValid = !hasPreOrder || (!!pickupDate && pickupDate >= minPickup && pickupDate <= maxPickup)
  const preOrderReady = !hasPreOrder || (pickupValid && !!idFile)
  const prettyPickup = pickupDate ? new Date(`${pickupDate}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric" }) : null

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0)

  function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setReceipt(file)
    setReceiptPreview(URL.createObjectURL(file))
  }

  async function handlePlaceOrder() {
    if (payment === "gcash" && !receipt) return
    if (items.length === 0 || shopCount > 1 || !preOrderReady || penaltyShops.length > 0) return
    setSubmitting(true)
    setOrderError(null)
    try {
      // Pre-order: the I.D. photo goes to private storage only this shop's staff can open
      let idPath: string | undefined
      if (hasPreOrder && idFile) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const storeId = items[0].sellerId
        if (!user || !storeId) throw new Error("Please sign in again.")
        const ext = idFile.name.split(".").pop() || "jpg"
        idPath = `${storeId}/${user.id}/${crypto.randomUUID()}.${ext}`
        const { error: idErr } = await supabase.storage.from("preorder-ids").upload(idPath, idFile, { contentType: idFile.type })
        if (idErr) throw new Error("Your I.D. couldn't be uploaded. Please try again with a JPG or PNG under 5 MB.")
      }
      let receiptUrl: string | undefined
      if (receipt) {
        // Upload receipt to Supabase Storage
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        const ext = receipt.name.split(".").pop() || "jpg"
        const path = `receipts/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage.from("order-receipts").upload(path, receipt)
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("order-receipts").getPublicUrl(path)
          receiptUrl = urlData.publicUrl
        }
      }
      const { orderIds } = unwrap(await submitOrder({ items: items.map((i) => ({ id: i.id, sellerId: i.sellerId, name: i.name, seller: i.seller, price: i.price, image: i.image, quantity: i.quantity, variant: i.variant, variantId: i.variantId })), paymentMethod: payment, receiptUrl, total: subtotal, ...(hasPreOrder ? { pickupDate, idPath } : {}) }))
      setPlaced(true)
      if (buyMode) clearBuyNowItem()
      else removeItems(items.map(lineKey))
      router.replace(`/marketplace/order-success?orders=${orderIds.join(",")}`)
    } catch (err: unknown) {
      setOrderError(err instanceof Error ? err.message : "Failed to place order. Please try again.")
      setSubmitting(false)
    }
  }

  if (placed) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Loader2 className="mx-auto size-10 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Order placed! Opening your confirmation…</p>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
        {[1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />)}
      </div>
    )
  }

  if (items.length === 0) {
    const toMarket = buyMode || cartItems.length === 0
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <ShoppingBag className="mx-auto size-12 text-muted-foreground/40" />
        <p className="mt-4 text-sm text-muted-foreground">
          {buyMode ? "Nothing to check out. Tap Buy on a product to start." : cartItems.length === 0 ? "Your cart is empty." : "No items selected for checkout."}
        </p>
        <Button asChild className="mt-4 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href={toMarket ? "/marketplace" : "/marketplace/cart"}>{toMarket ? "Browse Marketplace" : "Back to Cart"}</Link>
        </Button>
      </div>
    )
  }

  if (mixedPreOrder) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <AlertTriangle className="mx-auto size-12 text-amber-500" />
        <p className="mt-4 font-medium text-foreground">Pre-orders are checked out on their own</p>
        <p className="mt-1 text-sm text-muted-foreground">
          A pre-order needs an I.D. check and a pick-up date. Select only the pre-order items in your cart, or only the regular items.
        </p>
        <Button asChild className="mt-4 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href={buyMode ? "/marketplace" : "/marketplace/cart"}>{buyMode ? "Back to Marketplace" : "Back to Cart"}</Link>
        </Button>
      </div>
    )
  }

  if (penaltyShops.length > 0) {
    const total = penaltyShops.reduce((n, p) => n + p.amount, 0)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <AlertTriangle className="mx-auto size-12 text-destructive" />
        <p className="mt-4 font-medium text-foreground">You have an unpaid penalty with {penaltyShops[0].name}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          A pre-order wasn&apos;t picked up on time, so a ₱{total.toLocaleString()} penalty was added to your account. You can order from this shop again once it&apos;s paid.
        </p>
        <Button asChild className="mt-4 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/marketplace/account#penalties">View and pay penalty</Link>
        </Button>
      </div>
    )
  }

  if (availableMethods.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <AlertTriangle className="mx-auto size-12 text-amber-500" />
        <p className="mt-4 font-medium text-foreground">These items can&apos;t be paid the same way</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Some selected items are walk-in payment only and others are online only. Check them out separately.
        </p>
        <Button asChild className="mt-4 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href={buyMode ? "/marketplace" : "/marketplace/cart"}>{buyMode ? "Back to Marketplace" : "Back to Cart"}</Link>
        </Button>
      </div>
    )
  }

  if (shopCount > 1) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <AlertTriangle className="mx-auto size-12 text-amber-500" />
        <p className="mt-4 font-medium text-foreground">Check out one shop at a time</p>
        <p className="mt-1 text-sm text-muted-foreground">
          You selected items from {shopCount} shops. Each shop is paid separately, so select items from just one shop in your cart.
        </p>
        <Button asChild className="mt-4 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/marketplace/cart">Back to Cart</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">Checkout Details</h1>
        <div className="mt-2 h-px bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Left column */}
        <div className="flex-1 space-y-5">
          {/* Buyer info */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-serif text-sm font-semibold text-foreground sm:text-base">
                <MapPin className="size-4 text-primary" />
                Buyer Information
              </h2>
              <Link href="/marketplace/account" className="flex items-center gap-1 text-xs font-medium text-gold hover:underline">
                <Edit2 className="size-3.5" />Edit
              </Link>
            </div>
            <div className="mt-3 h-px bg-linear-to-r from-gold/40 to-transparent" />
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {[
                ["Full Name", buyer?.full_name],
                ["I.D. Number", buyer?.student_employee_id],
                ["Course", buyer?.course],
                ["Department", buyer?.department],
                ["Contact", buyer?.contact],
                ["Campus", buyer?.campus],
                ["Pickup Method", "Walk-in (SSU Campus)"],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className={v ? "font-medium text-foreground" : buyer ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground"}>
                    {buyer ? v || "Not set" : "Loading…"}
                  </p>
                </div>
              ))}
            </div>
            {profileProblem && (
              <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{profileProblem} <Link href="/marketplace/account" className="font-semibold underline">Update your profile</Link></span>
              </p>
            )}
          </section>

          {/* Order summary */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-serif text-sm font-semibold text-foreground sm:text-base">Order Items</h2>
            <div className="mt-2 h-px bg-linear-to-r from-gold/40 to-transparent" />
            <div className="mt-4 space-y-4">
              {/* Order items — from cart context */}
            {items.map((item) => (
                <div key={lineKey(item)} className="flex gap-3">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    <Image src={item.image || "/placeholder.jpg"} alt={item.name} fill className="object-cover" />
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <p className="line-clamp-1 text-sm font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.seller}</p>
                    <p className="text-xs text-muted-foreground">{item.variant} · Qty: {item.quantity}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", BADGE_STYLES[item.badge] ?? BADGE_STYLES["Available"])}>
                        {item.badge}
                      </span>
                      <span className="text-sm font-bold text-gold">₱{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Pre-order: pick-up date, I.D. for the shop to check, pay at pick-up, penalty warning */}
          {hasPreOrder && (
            <section className="rounded-2xl border border-gold/30 bg-gold/8 p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-serif text-sm font-semibold text-foreground sm:text-base">
                <Clock className="size-4 text-gold" />
                Pre-Order Details
              </h2>
              <div className="mt-2 h-px bg-linear-to-r from-gold/40 to-transparent" />

              {preOrderShop && (
                <dl className="mt-4 space-y-1 rounded-xl border border-border bg-card p-3 text-xs">
                  <div className="flex gap-2"><dt className="w-24 shrink-0 text-muted-foreground">Shop</dt><dd className="font-semibold text-foreground">{preOrderShop.name}</dd></div>
                  <div className="flex gap-2"><dt className="w-24 shrink-0 text-muted-foreground">Store hours</dt>
                    <dd className="whitespace-pre-line text-foreground">{preOrderShop.storeHours || "Not posted yet. Message the seller before visiting."}</dd></div>
                  {preOrderShop.location && <div className="flex gap-2"><dt className="w-24 shrink-0 text-muted-foreground">Pick up at</dt><dd className="whitespace-pre-line text-foreground">{preOrderShop.location}</dd></div>}
                </dl>
              )}

              {/* 1. Pick-up date */}
              <div className="mt-4">
                <label htmlFor="pickup-date" className="text-sm font-medium text-foreground">Pick-up date *</label>
                <p className="text-xs text-muted-foreground">Any day from tomorrow up to {preOrderShop?.claimDays ?? 7} days from today.</p>
                <Input id="pickup-date" type="date" min={minPickup} max={maxPickup} value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)} className="mt-1.5 w-48" aria-invalid={!!pickupDate && !pickupValid} />
                {pickupDate && !pickupValid && <p className="mt-1 text-xs text-destructive">Choose a date between {minPickup} and {maxPickup}.</p>}
              </div>

              {/* 2. I.D. */}
              <div className="mt-4">
                <p className="text-sm font-medium text-foreground">Your I.D. *</p>
                <p className="text-xs text-muted-foreground">A clear photo of your School ID or any valid I.D. The shop checks it before confirming your pre-order. Only this shop can see it.</p>
                <input ref={idRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (file.size > 5 * 1024 * 1024) { setOrderError("Your I.D. photo must be under 5 MB."); return }
                    setIdFile(file)
                    setIdPreview(URL.createObjectURL(file))
                  }} />
                {idPreview ? (
                  <div className="mt-2 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={idPreview} alt="Your I.D." className="h-20 w-32 rounded-lg border border-border object-cover" />
                    <button type="button" onClick={() => idRef.current?.click()} className="text-xs font-medium text-primary hover:underline">Replace photo</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => idRef.current?.click()}
                    className="mt-2 flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-gold/40 py-5 transition-colors hover:border-gold/70 hover:bg-gold/5">
                    <Upload className="size-6 text-gold/60" />
                    <span className="text-sm font-medium text-foreground">Upload a photo of your I.D.</span>
                    <span className="text-xs text-muted-foreground">JPG, PNG or WEBP, up to 5 MB</span>
                  </button>
                )}
              </div>

              {/* 3. How it works + penalty warning */}
              <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                <li><span className="font-medium text-foreground">No payment now.</span> Pay in cash at the shop&apos;s counter when you pick it up.</li>
                <li>The shop checks your I.D. When it&apos;s approved, your pre-order is marked <span className="font-medium text-foreground">For Pick Up</span>.</li>
                <li>Bring the same I.D. and your order number on your pick-up date.</li>
              </ul>
              <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  If you don&apos;t pick it up by the end of {prettyPickup ?? "your pick-up date"}, the pre-order is <span className="font-semibold">discarded</span> and a{" "}
                  <span className="font-semibold">₱{(preOrderShop?.penalty ?? 10).toLocaleString()} penalty</span> is added to your account. You won&apos;t be able to buy from {preOrderShop?.name ?? "this shop"} until it&apos;s paid.
                </span>
              </p>
            </section>
          )}

          {/* Payment method (pre-orders: paid at the counter on pick-up — no online payment) */}
          {!hasPreOrder && (
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-serif text-sm font-semibold text-foreground sm:text-base">
              <CreditCard className="size-4 text-primary" />
              Payment Method
            </h2>
            <div className="mt-2 h-px bg-linear-to-r from-gold/40 to-transparent" />
            <div className="mt-4 space-y-2.5">
              {availableMethods.map(({ id, label, icon: Icon, recommended }) => (
                <label
                  key={id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-all",
                    payment === id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30 hover:bg-muted/50",
                  )}
                >
                  <div className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                    payment === id ? "border-gold" : "border-muted-foreground/40",
                  )}>
                    {payment === id && <div className="size-2 rounded-full bg-gold" />}
                  </div>
                  <input type="radio" name="payment" value={id} checked={payment === id} onChange={() => setPayment(id)} className="sr-only" />
                  <Icon className={cn("size-4 shrink-0", payment === id ? "text-primary" : "text-muted-foreground")} />
                  <span className={cn("flex-1 text-sm font-medium", payment === id ? "text-foreground" : "text-muted-foreground")}>
                    {label}
                  </span>
                  {recommended && availableMethods.length > 1 && (
                    <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold">Recommended</span>
                  )}
                </label>
              ))}
            </div>
            {!allowedModes.includes("online") && (
              <p className="mt-3 text-xs text-muted-foreground">This store accepts walk-in payment only for these items.</p>
            )}
            {payment === "cash" && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <Banknote className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>Your order is reserved. Pay in cash at the store&apos;s counter, and the cashier will mark it paid and hand over your items. Bring your I.D. and order number.</span>
              </p>
            )}
          </section>
          )}

          {/* GCash QR + receipt upload */}
          {payment === "gcash" && (
            <section className="rounded-2xl border border-primary/15 bg-card p-5 shadow-sm">
              <h2 className="font-serif text-sm font-semibold text-foreground sm:text-base">GCash Payment</h2>
              <div className="mt-2 h-px bg-linear-to-r from-gold/40 to-transparent" />

              {/* Seller QR — hidden unless the seller's e-wallet QR is active (Section 8) */}
              <div className="mt-4 flex flex-col items-center gap-3">
                {sellerQrs.length > 0 ? (
                  sellerQrs.map((s) => (
                    <div key={s.sellerId} className="flex flex-col items-center gap-2">
                      <div className="relative size-44 overflow-hidden rounded-2xl border border-border bg-muted/40">
                        <Image src={s.qrUrl} alt={`${s.orgName} GCash QR`} fill className="object-contain" />
                      </div>
                      <p className="text-xs font-medium text-muted-foreground">{s.orgName}</p>
                    </div>
                  ))
                ) : (
                  <div className="flex size-44 items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-muted/40">
                    <div className="text-center">
                      <QrCode className="mx-auto size-16 text-primary/30" />
                      <p className="mt-1 text-[10px] font-medium text-muted-foreground">QR Code Placeholder</p>
                      <p className="text-[9px] text-muted-foreground">Seller hasn&apos;t uploaded an e-wallet QR yet</p>
                    </div>
                  </div>
                )}
                <p className="text-sm font-semibold text-foreground">Scan to Pay via GCash</p>
                <p className="text-xs text-muted-foreground">Replace this QR image in your Seller Dashboard</p>
              </div>

              {/* Instructions */}
              <ol className="mt-5 space-y-2">
                {[
                  "Open GCash on your phone",
                  'Tap "Pay QR" and scan the code above',
                  "Enter the exact total amount",
                  "Take a screenshot of the confirmation",
                  "Upload your receipt below",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>

              {/* Upload receipt */}
              <div className="mt-5">
                <input ref={fileRef} type="file" accept="image/*" onChange={handleReceiptChange} className="hidden" />
                {receiptPreview ? (
                  <div className="relative">
                    <Image
                      src={receiptPreview}
                      alt="Payment receipt"
                      width={400}
                      height={200}
                      className="w-full rounded-xl object-cover"
                    />
                    <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-emerald-500 px-2.5 py-1">
                      <CheckCircle2 className="size-3.5 text-white" />
                      <span className="text-[11px] font-semibold text-white">Receipt uploaded</span>
                    </div>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="mt-2 w-full rounded-xl border border-border py-2 text-xs text-muted-foreground hover:bg-muted"
                    >
                      Replace receipt
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gold/40 py-8 transition-colors hover:border-gold/70 hover:bg-gold/5"
                  >
                    <Upload className="size-7 text-gold/60" />
                    <span className="text-sm font-medium text-foreground">Upload payment receipt</span>
                    <span className="text-xs text-muted-foreground">JPG, PNG — tap to browse</span>
                  </button>
                )}
              </div>

              {!receipt && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/5 p-3 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  Please upload your GCash receipt before placing the order.
                </div>
              )}
            </section>
          )}
        </div>

        {/* Right — summary */}
        <div className="lg:w-72 xl:w-80">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="font-serif text-sm font-semibold text-foreground sm:text-base">Payment Summary</h2>
              <div className="mt-2 h-px bg-linear-to-r from-gold/40 to-transparent" />
              <div className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                  <span>₱{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span className="text-emerald-600 dark:text-emerald-400">Free</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Payment Method</span>
                  <span className="font-medium text-foreground capitalize">
                    {PAYMENT_METHODS.find(p => p.id === payment)?.label.split(" ")[0]}
                  </span>
                </div>
                <div className="border-t border-dashed border-border pt-3">
                  <div className="flex justify-between">
                    <span className="font-bold text-foreground">Total</span>
                    <span className="text-xl font-bold text-gold">₱{subtotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {orderError && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />{orderError}
                </div>
              )}

              <Button
                onClick={handlePlaceOrder}
                size="lg"
                className="mt-5 w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={submitting || !!profileProblem || (payment === "gcash" && !receipt) || !preOrderReady}
              >
                {submitting ? <><Loader2 className="size-4 animate-spin" /> Placing Order...</> : <>{hasPreOrder ? "Pre-Order" : payment === "gcash" ? "Mark as Paid & Place Order" : "Place Order"}<ChevronRight className="size-4" /></>}
              </Button>

              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                {hasPreOrder ? "The shop checks your I.D., then marks your pre-order For Pick Up." : "Your order will be reviewed by the seller."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="fixed bottom-16 inset-x-0 z-30 border-t border-border bg-primary px-4 py-3 shadow-lg lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <p className="text-xs text-primary-foreground/70">Total</p>
            <p className="text-lg font-bold text-gold">₱{subtotal.toLocaleString()}</p>
          </div>
          <Button
            onClick={handlePlaceOrder}
            disabled={submitting || !!profileProblem || (payment === "gcash" && !receipt) || !preOrderReady}
            className="rounded-full bg-gold px-6 font-semibold text-primary hover:bg-gold/80"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : hasPreOrder ? "Pre-Order" : payment === "gcash" ? "Pay & Order" : "Place Order"}
          </Button>
        </div>
      </div>
    </div>
  )
}
