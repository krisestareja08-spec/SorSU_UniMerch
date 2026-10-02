/** Client-safe storefront customization options (themes, banners, layout). */

export type StorefrontAccent = "maroon" | "gold" | "emerald" | "blue" | "slate"
export type StorefrontLayout = "grid" | "list"

/** Customization hooks (themes, banners, layout). Stored in seller_profiles.theme (jsonb). */
export type StorefrontTheme = {
  accent: StorefrontAccent
  layout: StorefrontLayout
  showBanner: boolean
  tagline: string | null
}

export const DEFAULT_THEME: StorefrontTheme = { accent: "maroon", layout: "grid", showBanner: true, tagline: null }

export const ACCENTS: Record<StorefrontAccent, { label: string; banner: string; ring: string; chip: string }> = {
  maroon:  { label: "Maroon",  banner: "from-primary to-primary/70",           ring: "ring-primary/30",  chip: "border-primary bg-primary text-primary-foreground" },
  gold:    { label: "Gold",    banner: "from-amber-500 to-yellow-400",         ring: "ring-amber-400/40", chip: "border-amber-500 bg-amber-500 text-white" },
  emerald: { label: "Emerald", banner: "from-emerald-700 to-emerald-500",      ring: "ring-emerald-500/30", chip: "border-emerald-600 bg-emerald-600 text-white" },
  blue:    { label: "Blue",    banner: "from-blue-800 to-blue-500",            ring: "ring-blue-500/30", chip: "border-blue-600 bg-blue-600 text-white" },
  slate:   { label: "Slate",   banner: "from-slate-800 to-slate-600",          ring: "ring-slate-500/30", chip: "border-slate-700 bg-slate-700 text-white" },
}

export function storefrontHref(sellerId: string) {
  return `/seller/${sellerId}`
}
