import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage, type LegalSection } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Terms and Conditions · UniMerch",
  description: "The rules for buying and selling on UniMerch, the Sorsogon State University campus marketplace.",
}

const SECTIONS: LegalSection[] = [
  {
    title: "Accepting these terms",
    points: [
      "By creating an account, or signing in with Google, you agree to these Terms and Conditions and to our Privacy Policy.",
      "If we change them in a way you need to agree to again, we'll ask you the next time you sign in. If you don't agree, you can't keep using your account.",
    ],
  },
  {
    title: "Your account",
    points: [
      "Use your real full name and a working contact number. Sellers use them to confirm and hand over your orders.",
      "One account per person. Keep your password private; you are responsible for orders placed with your account.",
      "University members may verify their identity with a School ID or COR. Verification unlocks restricted, role-based items; browsing and regular purchases are open to everyone.",
      "Accounts assigned to a management dashboard (Verification Admin, BAO, Supply Office, Cashier and seller organizations) are for managing and selling. They cannot place orders.",
    ],
  },
  {
    title: "Buying",
    points: [
      "Each checkout is for items from one shop, so you pay one seller one amount.",
      "Pay only through the methods shown at checkout for that product: walk-in (cash at the shop's counter) and/or online (GCash or bank transfer). For online payment, upload a clear receipt of the exact amount.",
      "Prices and stock are per size where a product comes in sizes. The price you see after choosing a size is the price you pay.",
      "Bring your I.D. and order number when you claim an order. Restricted items are only released after the seller checks your I.D.",
    ],
  },
  {
    title: "Pre-orders and penalties",
    points: [
      "Pre-orders aren't paid upfront. You upload a photo of your I.D. and choose a pick-up date within the shop's window (3 to 7 days); the shop checks your I.D. before marking the pre-order For Pick Up.",
      "Pay at the shop's counter when you pick it up, on or before your pick-up date.",
      "If an approved pre-order isn't picked up by the end of your pick-up date, it is discarded and the shop's penalty (₱10 unless the shop sets another amount) is charged to your account.",
      "While a penalty with a shop is unpaid, you can't order from that shop. Pay it at the shop's counter or online if the shop accepts it; the shop clears it once paid.",
    ],
  },
  {
    title: "Selling",
    points: [
      "Only accredited organizations and university offices set up by the Verification Admin can sell.",
      "Products are reviewed by BAO before they go live. List accurate names, prices, sizes, stock and photos, and honour the prices, sizes and payment methods you list.",
      "Products using the official university logo carry a BAO royalty, deducted from the seller's earnings, not added to the buyer's price.",
      "Use buyers' I.D. photos and personal details only to confirm and hand over their orders.",
    ],
  },
  {
    title: "Conduct",
    points: [
      "Be respectful in chats with buyers and sellers, and don't share another person's personal information.",
      "Don't place fake orders, upload false receipts or I.D.s, or misuse restricted items.",
      "Reports are reviewed by the Verification Admin and BAO. Accounts or shops that break these terms may be flagged, suspended or banned, and products may be pulled from the marketplace.",
    ],
  },
  {
    title: "Your personal data",
    points: [
      <>How we collect, use and protect your information is explained in our <Link href="/privacy" className="font-medium text-primary hover:underline">Privacy Policy</Link>.</>,
    ],
  },
]

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms and Conditions"
      intro="These terms explain how UniMerch works and what we expect from buyers and sellers. Please read them before using the marketplace."
      sections={SECTIONS}
      other={{ href: "/privacy", label: "Privacy Policy" }}
    />
  )
}
