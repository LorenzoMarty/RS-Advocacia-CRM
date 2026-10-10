import { cn } from "@/lib/utils"

// Cabeçalho padrão de página (mock): título grande, subtítulo abaixo e controles à direita.
function PageHeader({ title, subtitle, children, className }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-3 px-2 pt-2", className)}>
      <div className="min-w-0 flex-[1_1_240px]">
        <h1 className="m-0 text-page-title text-ink">{title}</h1>
        {subtitle ? <p className="m-0 mt-1.5 min-w-0 text-[1.07rem] font-medium text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  )
}

export { PageHeader }
