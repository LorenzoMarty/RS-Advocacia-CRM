import * as React from "react"
import * as HoverCardPrimitive from "@radix-ui/react-hover-card"

import { cn } from "@/lib/utils"

const HoverCard = HoverCardPrimitive.Root
const HoverCardTrigger = HoverCardPrimitive.Trigger

const HoverCardContent = React.forwardRef(
  ({ className, align = "center", sideOffset = 6, ...props }, ref) => (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-64 rounded-md border border-border bg-card p-3 text-card-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95",
          className,
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  ),
)
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName

export { HoverCard, HoverCardTrigger, HoverCardContent }
