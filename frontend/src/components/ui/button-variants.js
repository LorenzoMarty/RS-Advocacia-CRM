import { cva } from "class-variance-authority"

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill text-[length:var(--btn-fs)] font-bold transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]",
        secondary: "bg-surface-2 text-ink hover:bg-surface-3",
        ghost: "text-ink hover:bg-surface-2",
        destructive: "bg-[var(--danger-soft)] text-[var(--danger-ink)] hover:brightness-95",
        outline: "border border-solid border-line-strong bg-transparent text-ink hover:bg-surface-2",
        link: "text-ink underline underline-offset-4 hover:no-underline",
      },
      size: {
        default: "h-[var(--ctl-h)] px-5",
        sm: "h-[var(--ctl-h-sm)] px-3.5 text-[length:var(--btn-fs-sm)]",
        lg: "h-[var(--ctl-h)] px-5",
        icon: "size-[var(--ctl-h)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)
