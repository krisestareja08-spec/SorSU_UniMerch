import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
  title: "Terms of Use · UniMerch",
  description: "The rules for buying and selling on UniMerch, the Sorsogon State University campus marketplace.",
}

const SECTIONS: { title: string; points: string[] }[] = [
  {
    title: "Your account",
    points: [
      "Use your real full name and a working contact number. Sellers use them to confirm and hand over your orders.",
      "Keep your password private. You are responsible for orders placed with your account.",
      "University members may verify their identity with a School ID or COR. Verification only unlocks restricted, role-based items; browsing and regular purchases are open to everyone.",
      "Accounts assigned to a management dashboard (Verification Admin, BAO, Supply Office, Cashier and seller organizations) are for managing and selling. They cannot place orders.",
    ],
  },
  {
    title: "Buying",
    points: [
      "Each checkout is for items from one store, so you pay one seller one amount.",
      "Pay only through the methods shown at checkout for that product: walk-in (cash at the store's counter) and/or online (GCash or bank transfer).",
      "For online payment, upload a clear receipt of the exact amount. The seller verifies it before preparing your order.",
      "Pre-orders are paid in full upfront and must be claimed during the store's hours before the claim deadline shown at checkout. Unclaimed orders may be cancelled by the seller.",
      "Bring your I.D. and order number when you claim an order. Restricted items are only released after the seller checks your I.D.",
    ],
  },
  {
    title: "Selling",
    points: [
      "Only accredited organizations and university offices created by the Verification Admin can sell.",
      "Products are reviewed by BAO before they go live. List accurate names, prices, sizes, stock and photos.",
      "Products using the official university logo carry a BAO royalty, deducted from the seller's earnings, not added to the buyer's price.",
      "Honour the prices, sizes and payment methods you list, and keep orders and stock up to date.",
    ],
  },
  {
    title: "Conduct",
    points: [
      "Be respectful in chats with buyers and sellers. Don't share another person's personal information.",
      "Don't place fake orders, upload false receipts, or misuse restricted items.",
      "Reports are reviewed by the Verification Admin and BAO. Accounts or stores that break these rules may be flagged, suspended or banned, and products may be pulled from the marketplace.",
    ],
  },
]

export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link href="/auth/sign-up" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />Back
        </Link>
        <div className="mt-6 flex items-center gap-3">
          <Image src="/sorsu-seal.png" alt="Sorsogon State University seal" width={44} height={44} className="rounded-full ring-1 ring-border" />
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight">Terms of Use</h1>
            <p className="text-sm text-muted-foreground">UniMerch — Sorsogon State University campus marketplace</p>
          </div>
        </div>
        <div className="mt-3 h-px bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />

        <div className="mt-6 space-y-6">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="font-serif text-lg font-semibold text-foreground">{s.title}</h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
                {s.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
