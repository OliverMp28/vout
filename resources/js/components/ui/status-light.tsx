import * as React from "react"

import { cn } from "@/lib/utils"

export type StatusLightState = "off" | "busy" | "on" | "error" | "signal"

const STATE_CLASS: Record<StatusLightState, string> = {
  off: "bg-led-off",
  busy: "bg-warning motion-safe:animate-[status-blink_1s_steps(2,jump-none)_infinite]",
  on: "bg-success",
  error: "bg-danger",
  signal: "bg-signal-edge",
}

/**
 * Luz de estado (como el piloto de un aparato). Siempre va con texto: el
 * estado nunca se indica solo con el color. `busy` parpadea salvo con
 * "reducir movimiento".
 */
function StatusLight({
  state = "off",
  className,
  ...props
}: React.ComponentProps<"span"> & { state?: StatusLightState }) {
  return (
    <span
      data-slot="status-light"
      data-state={state}
      aria-hidden="true"
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-[3px] shadow-[inset_0_0_0_1px_oklch(0.2_0.01_245/0.18)]",
        STATE_CLASS[state],
        className
      )}
      {...props}
    />
  )
}

export { StatusLight }
