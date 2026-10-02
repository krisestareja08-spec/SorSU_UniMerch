import { redirect } from "next/navigation"
import { storefrontHref } from "@/lib/storefront"

/** Old storefront URL — storefronts now live at /seller/[sellerId]. */
export default async function LegacyStorefrontRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(storefrontHref(id))
}
