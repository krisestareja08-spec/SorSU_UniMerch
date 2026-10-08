import type { Metadata } from "next"
import { LegalPage, type LegalSection } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy · UniMerch",
  description: "What personal information UniMerch collects, why, who can see it, and your rights.",
}

const SECTIONS: LegalSection[] = [
  {
    title: "What we collect",
    points: [
      "Account details: your name, email address, password (stored securely by our sign-in provider, never readable by staff) and, if you use Google, your Google name and profile photo.",
      "Profile details you give us: contact number, campus, department or course, birthday and Student / Employee I.D. number.",
      "Verification documents: the School ID or COR you upload to verify your university identity.",
      "Pre-order I.D. photos: the photo of your I.D. you upload when placing a pre-order.",
      "Orders and payments: what you order, sizes and quantities, payment method, payment receipts and reference numbers, pick-up dates and any penalties.",
      "Messages: chats with shops about products and orders, including images you send.",
      "App data: your cart (so it follows you across devices), notifications, and settings such as dark mode and browser alerts.",
    ],
  },
  {
    title: "Why we use it",
    points: [
      "To create and secure your account, and to keep one account per person.",
      "To verify your university identity and unlock restricted items you're eligible for.",
      "To process orders: shops use your name, contact number and I.D. to confirm orders, check pre-orders and hand over items.",
      "To send order, payment and message notifications.",
      "To keep the marketplace safe: handling reports, penalties, suspensions and bans.",
      "University offices (BAO) use order totals and royalties for sales reports. These reports are about products and shops, not about individual buyers.",
    ],
  },
  {
    title: "Who can see it",
    points: [
      "Shops see the details needed for your orders with them: your name, contact number, verification status, the I.D. photo for your pre-orders, receipts you upload and your chats with them.",
      "The Verification Admin sees account and verification details to review identities, handle reports and keep accounts in good standing.",
      "BAO sees products, shops, sales and royalty figures for oversight.",
      "Your information is stored with our hosting and database provider (Supabase). We don't sell your information or share it for advertising.",
      "Private files (verification documents and pre-order I.D. photos) can only be opened by you and the staff who need them, through short-lived links.",
    ],
  },
  {
    title: "How long we keep it",
    points: [
      "Your account information is kept while your account is active.",
      "Order records, receipts and penalties are kept for the shops' and the university's sales and audit records.",
      "If your account is deleted, your profile, cart, messages, requests and memberships are deleted. Records that only name you as the person who took an action are kept without your name.",
    ],
  },
  {
    title: "Your rights",
    points: [
      "Under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173), you may ask to access, correct or delete your personal information, and object to how it is used.",
      "You can update your profile and contact number yourself in your account and Settings.",
      "To request a copy of your data, a correction you can't make yourself, or deletion of your account, contact the Verification Admin through the university.",
    ],
  },
  {
    title: "Security",
    points: [
      "Data is encrypted in transit (HTTPS) and at rest by our database provider, and access is limited by role: each person and dashboard can only reach the records they need.",
      "No system is perfectly secure. Keep your password private and sign out on shared devices.",
    ],
  },
  {
    title: "Changes to this policy",
    points: [
      "If we change this policy in a way you need to agree to again, we'll ask you the next time you sign in.",
    ],
  },
]

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy explains what personal information UniMerch collects when you use the campus marketplace, why we need it, who can see it, and the choices you have."
      sections={SECTIONS}
      other={{ href: "/terms", label: "Terms and Conditions" }}
    />
  )
}
