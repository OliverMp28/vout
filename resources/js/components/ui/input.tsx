import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input file:text-foreground placeholder:text-muted-foreground selection:bg-signal selection:text-signal-foreground flex h-10 w-full min-w-0 rounded-control border bg-surface-2 px-3 py-1 text-base shadow-[inset_0_1px_2px_oklch(0.2_0.01_245/0.07)] transition-[color,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "aria-invalid:border-danger",
        className
      )}
      {...props}
    />
  )
}

export { Input }
