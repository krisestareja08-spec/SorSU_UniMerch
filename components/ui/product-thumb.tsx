import type { ReactNode } from "react"
import { Package } from "lucide-react"
import Image from "@/components/ui/smart-image"
import { cn } from "@/lib/utils"

const SIZES = { xs: "size-8 rounded-md", sm: "size-10 rounded-lg", md: "size-12 rounded-lg", lg: "size-16 rounded-xl" }
// Width each size is shown at, so a small photo is downloaded small
const PIXELS = { xs: "32px", sm: "40px", md: "48px", lg: "64px" }

/** A product's photo, the same everywhere a product is picked or managed; a box icon when it has none. */
export function ProductThumb({ src, alt = "", size = "sm", className }: { src?: string | null; alt?: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span className={cn("relative flex shrink-0 items-center justify-center overflow-hidden border border-border bg-muted", SIZES[size], className)}>
      {src
        ? <Image src={src} alt={alt} fill sizes={PIXELS[size]} className="object-cover" />
        : <Package className="size-1/2 text-muted-foreground/50" aria-hidden />}
    </span>
  )
}

/** The product being worked on, at the top of a form: photo, name, size and stock. */
export function ProductHeader({ image, name, detail, aside }: { image?: string | null; name: string; detail?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <ProductThumb src={image} alt={name} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{name}</p>
        {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
      </div>
      {aside}
    </div>
  )
}
