import * as ProgressPrimitive from "@radix-ui/react-progress"
import * as React from "react"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-surface-sunken relative h-2 w-full overflow-hidden rounded-full border border-border",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="bg-signal-edge h-full w-full flex-1 rounded-full transition-[color,background-color,border-color,opacity,transform] duration-300"
        style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
