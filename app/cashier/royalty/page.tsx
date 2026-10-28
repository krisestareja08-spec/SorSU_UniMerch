import { redirect } from "next/navigation"

// Branches don't remit royalty: the Main Supply Office pays it on their sales (/supply-office/royalty)
export default function Page() {
  redirect("/cashier")
}
