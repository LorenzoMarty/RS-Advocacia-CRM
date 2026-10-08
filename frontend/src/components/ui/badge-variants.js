import { cva } from "class-variance-authority"

export const badgeVariants = cva(
  "inline-flex items-center rounded-pill border px-2.5 py-1 text-[11px] font-bold leading-none transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-surface-2 text-ink-2",
        secondary: "border-transparent bg-surface-2 text-ink-2",
        destructive: "border-transparent bg-[var(--danger-soft)] text-[var(--danger-ink)]",
        success: "border-transparent bg-[var(--success-soft)] text-[var(--success-ink)]",
        warn: "border-transparent bg-[var(--warn-soft)] text-[var(--warn-ink)]",
        outline: "border-line-strong text-ink-2",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)
