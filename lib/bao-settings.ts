import { createClient } from "@/lib/supabase/server"

const DEFAULT_ROYALTY_PERCENTAGE = 3

/** Section 6 — BAO-controlled global royalty rate applied to new logo products. */
export async function getGlobalRoyaltyPercentage(): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("bao_settings")
    .select("global_royalty_percentage")
    .eq("id", 1)
    .maybeSingle()
  return data?.global_royalty_percentage != null ? Number(data.global_royalty_percentage) : DEFAULT_ROYALTY_PERCENTAGE
}
