import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Una tecla del teclado ("Espacio", "Esc", "Ctrl"). Solo para atajos y
 * controles reales: sirve de información, no de adorno.
 */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-[5px] border border-border-strong bg-key-light px-1.5 font-mono text-xs font-semibold text-foreground shadow-[0_2px_0_0_var(--key-light-edge)]",
        className
      )}
      {...props}
    />
  )
}

export { Kbd }
