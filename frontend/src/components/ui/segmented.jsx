import { cn } from "@/lib/utils"

// Filtro em pílula. tone="bg": container --surface sobre o fundo da página, ativa preta.
// tone="surface-2" (padrão): dentro de cards, ativa branca com sombra mínima.
function Segmented({ options, value, onChange, tone = "surface-2", label, className }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex gap-1 rounded-pill p-1",
        tone === "bg" ? "bg-surface" : "bg-surface-2",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-pill px-3.5 py-2 text-[.93rem] font-bold leading-none text-ink-2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink",
              active && tone === "bg" && "bg-[var(--accent)] text-[var(--accent-fg)] hover:text-[var(--accent-fg)]",
              active && tone !== "bg" && "bg-surface text-ink shadow-[0_1px_2px_rgba(23,24,28,.1)]",
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export { Segmented }
