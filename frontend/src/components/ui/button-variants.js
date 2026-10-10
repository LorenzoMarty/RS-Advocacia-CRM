import { cva } from "class-variance-authority"

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill text-[length:var(--btn-fs)] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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
        default: "h-[var(--btn-h)] px-5 max-[1024px]:h-11",
        sm: "h-[var(--btn-h-sm)] px-3.5 text-[length:var(--btn-fs-sm)] max-[1024px]:h-10",
        lg: "h-[var(--btn-h)] px-5 max-[1024px]:h-11",
        icon: "size-[var(--btn-h)] max-[1024px]:size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)
