import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Botones de Vout: teclas que se hunden al pulsar. Cada variante con tecla
 * define su color de borde inferior (`--edge`) y su profundidad (`--depth`).
 *
 * - `play`: la tecla de color (cian). Solo "Jugar" y "Activar cámara".
 * - `default`: la tecla principal (oscura; clara en tema oscuro).
 * - `secondary` / `outline`: la tecla clara, de apoyo.
 * - `destructive`: borrar o revocar.
 * - `ghost` y `link`: sin tecla.
 *
 * Código propio: no volver a generarlo con `shadcn add`.
 */
const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-control border font-semibold whitespace-nowrap select-none [--depth:3px] transition-[transform,box-shadow,background-color,border-color,color,filter] duration-[110ms] ease-out outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground [--edge:var(--key-edge)] hover:brightness-110",
        play:
          "border-signal-edge bg-signal text-signal-foreground [--edge:var(--signal-edge)] hover:brightness-105",
        destructive:
          "border-danger-edge bg-danger text-danger-foreground [--edge:var(--danger-edge)] hover:brightness-105",
        outline:
          "border-border-strong bg-key-light text-foreground [--edge:var(--key-light-edge)] hover:bg-surface-hover",
        secondary:
          "border-border-strong bg-key-light text-foreground [--edge:var(--key-light-edge)] hover:bg-surface-hover",
        ghost:
          "border-transparent bg-transparent text-foreground [--depth:0px] hover:bg-surface-hover active:translate-y-px",
        link: "border-transparent bg-transparent text-foreground underline decoration-border-strong decoration-[1.5px] underline-offset-4 [--depth:0px] hover:decoration-signal-strong",
      },
      size: {
        default: "h-10 px-4 text-sm has-[>svg]:px-3.5",
        sm: "h-8 px-3 text-[13px] [--depth:2px] has-[>svg]:px-2.5",
        lg: "h-11.5 px-6 text-base has-[>svg]:px-5",
        icon: "size-10",
        "icon-sm": "size-8 [--depth:2px]",
        "icon-lg": "size-11.5",
      },
    },
    compoundVariants: [
      {
        variant: ["default", "play", "destructive", "outline", "secondary"],
        className:
          "shadow-[0_var(--depth)_0_0_var(--edge)] active:translate-y-(--depth) active:shadow-none disabled:translate-y-(--depth) disabled:shadow-none",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
