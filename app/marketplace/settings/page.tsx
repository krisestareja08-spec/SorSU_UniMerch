import { Bell, ShieldCheck, Globe, Moon, Smartphone } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeSelect } from "@/components/theme-select"

const SECTIONS = [
  {
    title: "Notifications",
    icon: Bell,
    settings: [
      { label: "Order updates",         desc: "Get notified when your order status changes", defaultOn: true },
      { label: "New messages",          desc: "Alerts when a seller replies to your chat",   defaultOn: true },
      { label: "Flash sale alerts",     desc: "Be the first to know about campus sales",     defaultOn: false },
      { label: "Promotional emails",    desc: "Weekly digest of new org products",           defaultOn: false },
    ],
  },
  {
    title: "Privacy",
    icon: ShieldCheck,
    settings: [
      { label: "Show my order history to sellers", desc: "Sellers can see your purchase history in their shop", defaultOn: false },
      { label: "Show online status",               desc: "Let sellers see when you are online",                 defaultOn: true },
    ],
  },
  {
    title: "Appearance",
    icon: Moon,
    settings: [
      { label: "Theme", desc: "System follows your device's light/dark preference", defaultOn: true, control: "theme" },
    ],
  },
  {
    title: "Language & Region",
    icon: Globe,
    settings: [
      { label: "English (Philippines)", desc: "Language used throughout the app", defaultOn: true },
    ],
  },
]

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your preferences and account settings.</p>
        <div className="mt-3 h-px bg-gradient-to-r from-gold/60 via-gold/20 to-transparent" />
      </div>

      <div className="space-y-4">
        {SECTIONS.map(({ title, icon: Icon, settings }) => (
          <Card key={title} className="border-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-serif text-base">
                <Icon className="size-4 text-primary" /> {title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-border">
              {settings.map(({ label, desc, defaultOn, ...rest }) => (
                <div key={label} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  {"control" in rest && rest.control === "theme" ? <ThemeSelect /> : (
                  /* Toggle */
                  <label className="relative shrink-0 cursor-pointer">
                    <input type="checkbox" defaultChecked={defaultOn} className="sr-only peer" />
                    <div className="h-6 w-11 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30" />
                    <div className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                  </label>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {/* Account section */}
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <Smartphone className="size-4 text-primary" /> Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium">buyer@unimerch.sorsu.edu.ph</p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground">Role</p>
              <p className="text-sm font-medium">Buyer — Student</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
