import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Badges: 20px de alto, radio 4, texto 12. Los tonos semánticos
// (success/warning/danger/info) son los únicos con color; `neutral` es el
// default. Para estados de dominio usar StatusBadge (ícono + texto).
const badgeVariants = cva(
  "inline-flex h-5 items-center justify-center gap-1 rounded-sm border px-1.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 [&>svg]:pointer-events-none transition-colors overflow-hidden",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        neutral: "border-border bg-card text-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border bg-transparent text-foreground",
        success: "border-success-border bg-success-bg text-success",
        warning: "border-warning-border bg-warning-bg text-warning",
        danger: "border-danger-border bg-danger-bg text-danger",
        info: "border-info-border bg-info-bg text-info",
        destructive: "border-danger-border bg-danger-bg text-danger",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
