"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * Number badges on the menus (scripts/32 §3e): what's new or waiting for review / action.
 * Keys are page paths under the dashboard, e.g. { orders: 3, "special-orders": 1 }.
 * Badges are a convenience: any error just means no badges.
 */
export async function getNavBadges(dashboardId: string): Promise<Record<string, number>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("nav_badges", { p_dashboard: dashboardId })
    return error || !data ? {} : (data as Record<string, number>)
  } catch {
    return {}
  }
}

/** Buyers: orders to pick up and conversations with unread replies. */
export async function getBuyerBadges(): Promise<Record<string, number>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("buyer_badges")
    return error || !data ? {} : (data as Record<string, number>)
  } catch {
    return {}
  }
}
