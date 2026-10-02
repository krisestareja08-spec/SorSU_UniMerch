import { redirect } from "next/navigation"

/** Stock movement now lives on the Inventory page. */
export default function MovementPage() {
  redirect("/supply-office/inventory")
}
