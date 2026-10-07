"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

// tone="surface-2" (padrão): container --surface-2, aba ativa branca.
// tone="bg": container --surface sobre o --bg da página, aba ativa preta.
const TabsList = React.forwardRef(({ className, tone = "surface-2", ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    data-tone={tone}
    className={cn(
      "group/tabs inline-flex h-auto items-center justify-center gap-1 rounded-pill p-1 text-muted-foreground",
      tone === "bg" ? "bg-surface" : "bg-surface-2",
      className
    )}
    {...props} />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-pill px-3.5 py-1.5 text-[13px] font-bold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-[0_1px_2px_rgba(23,24,28,.1)] group-data-[tone=bg]/tabs:data-[state=active]:bg-[var(--accent)] group-data-[tone=bg]/tabs:data-[state=active]:text-[var(--accent-fg)] group-data-[tone=bg]/tabs:data-[state=active]:shadow-none",
      className
    )}
    {...props} />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props} />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
