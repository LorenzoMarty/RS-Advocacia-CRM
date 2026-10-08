import { cn } from "@/lib/utils"

// Cabeçalho padrão de página, compacto: título + subtítulo na mesma linha (o subtítulo quebra
// para baixo só se não couber) e controles à direita, em uma linha quando a largura permite.
function PageHeader({ title, subtitle, children, className }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-1 pt-0.5", className)}>
      <div className="flex min-w-0 flex-[1_1_240px] flex-wrap items-baseline gap-x-3 gap-y-0">
        <h1 className="m-0 text-page-title text-ink">{title}</h1>
        {subtitle ? <p className="m-0 min-w-0 text-[1rem] font-medium text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  )
}

export { PageHeader }
