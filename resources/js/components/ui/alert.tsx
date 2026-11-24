import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Aviso: bandeja con una barra de color a la izquierda según el estado. El
 * título toma el color del estado (con contraste comprobado); el texto sigue
 * siendo el normal. Mantiene `data-slot="alert"` (lo usan los tests).
 */
const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 overflow-hidden rounded-surface border bg-surface-1 py-3 pr-4 pl-5 text-sm text-foreground shadow-surface before:absolute before:inset-y-2.5 before:left-2 before:w-1 before:rounded-full before:bg-border-strong has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "",
        info: "before:bg-info [&>svg]:text-info-text *:data-[slot=alert-title]:text-info-text",
        success:
          "before:bg-success [&>svg]:text-success-text *:data-[slot=alert-title]:text-success-text",
        warning:
          "before:bg-warning [&>svg]:text-warning-text *:data-[slot=alert-title]:text-warning-text",
        destructive:
          "before:bg-danger [&>svg]:text-danger-text *:data-[slot=alert-title]:text-danger-text",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-bold tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
