import { cn } from "@/lib/utils"

// Filtro em pílula; a opção ativa é sempre branca (--surface) com sombra mínima.
// tone="bg": container --surface-3 sobre o fundo da página; "surface-2" (padrão): dentro de cards.
function Segmented({ options, value, onChange, tone = "surface-2", label, className }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex gap-1 rounded-pill p-1",
        tone === "bg" ? "bg-surface-3" : "bg-surface-2",
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
              "rounded-pill px-3.5 py-2 text-[.93rem] max-[1024px]:min-h-[40px] font-bold leading-none text-ink-2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink",
              active && "bg-surface text-ink shadow-[0_1px_3px_rgba(23,24,28,.1)]",
            )}
          >
            {option.dot ? <span className="mr-2 inline-block size-2 rounded-full align-middle" style={{ background: option.dot }} aria-hidden="true" /> : null}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export { Segmented }
