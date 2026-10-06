import Image from "next/image"
import { cn } from "@/lib/utils"

type Size = "sm" | "md" | "lg"

const seal: Record<Size, number> = { sm: 40, md: 76, lg: 104 }
const wordmark: Record<Size, string> = {
  sm: "text-xl",
  md: "text-3xl",
  lg: "text-4xl",
}

/**
 * UniMerch brand lockup: SorSU seal + "UniMerch" wordmark.
 * The seal image is a replaceable placeholder (swap /public/sorsu-seal.png).
 */
export function UniMerchWordmark({
  size = "md",
  showSeal = true,
  showTagline = true,
  className,
}: {
  size?: Size
  showSeal?: boolean
  showTagline?: boolean
  className?: string
}) {
  const s = seal[size]
  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      {showSeal && (
        <div className="relative mb-4 rounded-full bg-card p-1.5 shadow-lg ring-1 ring-border">
          <Image
            src="/sorsu-seal.png"
            alt="Sorsogon State University seal"
            width={s}
            height={s}
            priority
            className="rounded-full"
          />
        </div>
      )}

      <p className={cn("font-serif font-extrabold leading-none tracking-tight", wordmark[size])}>
        <span className="text-primary">Uni</span>
        <span className="text-gold">Merch</span>
      </p>

      {showTagline && (
        <>
          <p className="mt-2 text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-primary">
            Campus Marketplace
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Sorsogon State University </p>
        </>
      )}
    </div>
  )
}
