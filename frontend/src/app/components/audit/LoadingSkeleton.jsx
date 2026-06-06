// Skeleton exibido enquanto o store carrega as coleções.
export function LoadingSkeleton() {
  return (
    <div className="audit-page" aria-busy="true" aria-label="Carregando auditoria">
      <div className="audit-skel audit-skel-hero" />
      <div className="audit-grid-focus">
        <div className="audit-skel audit-skel-block" />
        <div className="audit-skel audit-skel-block" />
      </div>
      <div className="audit-grid-2">
        <div className="audit-skel audit-skel-block" />
        <div className="audit-skel audit-skel-block" />
      </div>
    </div>
  );
}
