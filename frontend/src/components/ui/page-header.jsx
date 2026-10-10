import { cn } from "@/lib/utils"

// Cabeçalho padrão de página (mock): título grande, subtítulo abaixo e controles à direita.
// compact: título + subtítulo na mesma linha, menor (usado no Painel).
function PageHeader({ title, subtitle, children, className, compact = false }) {
  return (
    <div
      className={cn(
        compact
          ? "flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-1 pt-0.5"
          : "flex flex-wrap items-end justify-between gap-x-4 gap-y-3 px-2 pt-2",
        className,
      )}
    >
      <div className={cn("min-w-0 flex-[1_1_240px]", compact && "flex flex-wrap items-baseline gap-x-3 gap-y-0")}>
        <h1 className={cn("m-0 text-ink", compact ? "text-[1.85rem] font-bold leading-[1.1] tracking-[-0.02em]" : "text-page-title")}>{title}</h1>
        {subtitle ? <p className={cn("m-0 min-w-0 font-medium text-muted-foreground", compact ? "text-[1rem]" : "mt-1.5 text-[1.07rem]")}>{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  )
}

export { PageHeader }
