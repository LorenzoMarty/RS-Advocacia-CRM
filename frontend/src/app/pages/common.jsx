export function EmptyState({ title, copy, actions = null, className = '' }) {
  return (
    <div className={`empty-state${className ? ` ${className}` : ''}`}>
      <div className="empty">
        <strong>{title}</strong>
        <p>{copy}</p>
        {actions ? <div className="empty-actions">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Field({
  id,
  label,
  error = '',
  className = '',
  children,
  headLink = null,
  note = null,
}) {
  return (
    <div className={`field${error ? ' has-error' : ''}${className ? ` ${className}` : ''}`}>
      {headLink ? (
        <div className="field-head">
          <label htmlFor={id}>{label}</label>
          {headLink}
        </div>
      ) : (
        <label htmlFor={id}>{label}</label>
      )}
      {children}
      {note ? <p className="field-help">{note}</p> : null}
      {error ? <div className="field-error">{error}</div> : null}
    </div>
  );
}

export function NotFoundState({ title = 'Registro não encontrado.', copy = 'Volte para a listagem e selecione outro item.' }) {
  return (
    <div className="surface section-card">
      <div className="empty">
        <strong>{title}</strong>
        <p>{copy}</p>
      </div>
    </div>
  );
}
