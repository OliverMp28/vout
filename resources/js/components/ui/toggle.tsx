import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-control text-sm font-semibold hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-50 data-[state=on]:border-signal-soft-border data-[state=on]:bg-signal-soft data-[state=on]:text-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring outline-none transition-[color,background-color,border-color,transform] active:translate-y-px aria-invalid:border-danger",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-border-strong bg-key-light shadow-[0_2px_0_0_var(--key-light-edge)] hover:bg-surface-hover data-[state=on]:shadow-[inset_0_1px_2px_oklch(0.2_0.01_245/0.12)]",
      },
      size: {
        default: "h-10 px-3 min-w-10",
        sm: "h-8 px-1.5 min-w-8",
        lg: "h-10 px-2.5 min-w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
