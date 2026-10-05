import { createClient } from "@/lib/supabase/server"
import { storefrontHref } from "@/lib/storefront-theme"
import { BannerCarousel, type HomeBanner } from "./banner-carousel"

/** Loads banners that are running right now (RLS only returns those inside their start/end window). */
export async function HomeBanners() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("store_banners")
    .select("id, title, subtitle, image_url, link_url, seller_id, ends_at")
    .order("ends_at", { ascending: true })
    .limit(10)
  const rows = data ?? [] // empty until scripts/26 runs

  const storeIds = [...new Set(rows.map((b) => b.seller_id as string))]
  const { data: stores } = storeIds.length
    ? await supabase.from("seller_profiles").select("id, org_name").in("id", storeIds)
    : { data: [] as { id: string; org_name: string }[] }
  const names = new Map((stores ?? []).map((s) => [s.id, s.org_name]))

  const banners: HomeBanner[] = rows.map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    image_url: b.image_url,
    href: b.link_url || storefrontHref(b.seller_id),
    store: names.get(b.seller_id) ?? null,
  }))
  return <BannerCarousel banners={banners} />
}
