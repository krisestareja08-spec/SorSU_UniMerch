import { Badge } from "@/components/ui/badge"
import { BadgeCheck, Clock, ShieldAlert, XCircle } from "lucide-react"
import type { VerificationStatus } from "@/lib/roles"
import { cn } from "@/lib/utils"

const CONFIG: Record<
  VerificationStatus,
  { label: string; icon: typeof BadgeCheck; className: string }
> = {
  approved: {
    label: "Verified member",
    icon: BadgeCheck,
    className: "border-transparent bg-primary text-primary-foreground",
  },
  pending: {
    label: "Verification pending",
    icon: Clock,
    className: "border-transparent bg-accent text-accent-foreground",
  },
  rejected: {
    label: "Verification rejected",
    icon: XCircle,
    className: "border-transparent bg-destructive/15 text-destructive",
  },
  unverified: {
    label: "Not verified",
    icon: ShieldAlert,
    className: "border-border bg-muted text-muted-foreground",
  },
}

export function VerificationStatusBadge({
  status,
  className,
}: {
  status: VerificationStatus
  className?: string
}) {
  const { label, icon: Icon, className: styles } = CONFIG[status]
  return (
    <Badge className={cn("gap-1.5", styles, className)}>
      <Icon className="size-3.5" aria-hidden />
      {label}
    </Badge>
  )
}
