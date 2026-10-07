import { cn } from "@/lib/utils"

// Cabeçalho padrão de página: título + subtítulo à esquerda, filtros/segmented à direita.
function PageHeader({ title, subtitle, children, className }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4 px-2 pt-2", className)}>
      <div className="min-w-0">
        <h1 className="m-0 text-page-title text-ink">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-[1.07rem] font-medium text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2.5">{children}</div> : null}
    </div>
  )
}

export { PageHeader }
