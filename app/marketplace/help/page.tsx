import { HelpCircle, MessageCircle, Book, AlertTriangle, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

const FAQS = [
  { q: "How do I place an order?",           a: "Browse the marketplace, add items to your cart, then go to Checkout. Choose your payment method and confirm." },
  { q: "What payment methods are accepted?", a: "We accept GCash (QR scan) and Cash (walk-in). Select your method at checkout." },
  { q: "How do I track my order?",           a: "Go to My Orders from your account page or bottom nav to see real-time order status." },
  { q: "What are restricted items?",         a: "Restricted items like faculty uniforms require identity verification. Upload your School ID or COR in your profile." },
  { q: "How do I verify my identity?",       a: "Go to your Profile → Verify My Identity and upload your valid School ID or Certificate of Registration (COR)." },
  { q: "Can I cancel an order?",             a: "You can request cancellation before the seller confirms your payment. Contact the seller via chat." },
  { q: "How do I contact a seller?",         a: "Open any product page and tap the chat icon, or go to Messages in your account." },
]

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Help Centre</h1>
        <p className="mt-1 text-sm text-muted-foreground">Answers to common questions about UniMerch.</p>
        <div className="mt-3 h-px bg-gradient-to-r from-gold/60 via-gold/20 to-transparent" />
      </div>

      {/* Quick links */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: "Chat Support",  icon: MessageCircle, href: "/marketplace/messages" },
          { label: "User Guide",    icon: Book,          href: "#guide" },
          { label: "Report Issue",  icon: AlertTriangle, href: "#report" },
        ].map(({ label, icon: Icon, href }) => (
          <Link key={label} href={href}
            className="flex flex-col items-center gap-2 rounded-2xl border border-primary/10 bg-card p-4 text-center text-xs font-medium transition-all hover:border-primary/25 hover:shadow-sm active:scale-95">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/8">
              <Icon className="size-4 text-primary" />
            </div>
            {label}
          </Link>
        ))}
      </div>

      {/* FAQs */}
      <Card className="border-primary/10">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 font-serif text-base">
            <HelpCircle className="size-4 text-primary" /> Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border space-y-0 p-0">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="group px-4 py-3 cursor-pointer">
              <summary className="flex items-center justify-between gap-3 text-sm font-medium list-none">
                {q}
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{a}</p>
            </details>
          ))}
        </CardContent>
      </Card>

      {/* Contact */}
      <div className="mt-4 rounded-2xl border border-gold/20 bg-gold/5 p-4 text-center">
        <p className="text-sm font-medium text-foreground">Still need help?</p>
        <p className="mt-1 text-xs text-muted-foreground">Email us at <span className="font-medium text-primary">support@unimerch.sorsu.edu.ph</span></p>
      </div>
    </div>
  )
}
