import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Insignias. `default`, `secondary` y `outline` son neutras; los estados
 * (`success`, `warning`, `info`, `danger`) llevan su color con texto propio;
 * `gesture` marca los juegos con control por gestos y `pixel` es la etiqueta
 * corta en letra pixel. Código propio: no regenerar con `shadcn add`.
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border px-2 py-0.5 text-xs font-semibold whitespace-nowrap transition-[color,background-color,border-color] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "border-border bg-surface-2 text-foreground [a&]:hover:bg-surface-hover",
        secondary:
          "border-transparent bg-surface-sunken text-foreground [a&]:hover:bg-surface-hover",
        outline:
          "border-border-strong bg-transparent text-foreground [a&]:hover:bg-surface-hover",
        gesture: "border-signal-soft-border bg-signal-soft text-foreground",
        success: "border-success bg-success text-success-foreground",
        warning: "border-warning bg-warning text-warning-foreground",
        info: "border-info bg-info text-info-foreground",
        danger: "border-danger bg-danger text-danger-foreground",
        destructive: "border-danger bg-danger text-danger-foreground",
        pixel:
          "border-border-strong bg-surface-2 font-pixel text-[15px] leading-none font-normal tracking-[0.04em] text-foreground uppercase",
      },
    },
    defaultVariants: {
      variant: "default",
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
