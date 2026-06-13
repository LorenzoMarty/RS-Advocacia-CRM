import { useState } from 'react';

const CUSTOM_OPTION = '__custom__';

// Select com opção de digitar um valor novo (combobox). Mesmo padrão do "Tipo de
// compromisso" da agenda; reusa as classes .type-combo / .type-combo-back.
export function ComboField({
  id,
  value,
  options,
  onChange,
  selectPlaceholder = 'Selecione',
  customLabel = '+ Digitar novo...',
  customPlaceholder = 'Digite o novo valor',
}) {
  // Inclui o valor atual na lista para que a `<option>` dele seja fixa: alterar opções durante o
  // onChange do <select> (option condicional) causava o crash removeChild do React.
  const known = [...new Set([...(value ? [value] : []), ...options].filter(Boolean))];
  const [mode, setMode] = useState(() => (value && !options.filter(Boolean).includes(value) ? 'custom' : 'select'));

  if (mode === 'custom') {
    return (
      <div className="type-combo">
        <input
          id={id}
          value={value}
          placeholder={customPlaceholder}
          autoFocus
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="type-combo-back"
          onClick={() => {
            setMode('select');
            onChange(known[0] || '');
          }}
        >
          ← Selecionar
        </button>
      </div>
    );
  }

  return (
    <select
      id={id}
      value={value}
      onChange={(event) => {
        if (event.target.value === CUSTOM_OPTION) {
          setMode('custom');
          onChange('');
        } else {
          onChange(event.target.value);
        }
      }}
    >
      <option value="">{selectPlaceholder}</option>
      {known.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
      <option value={CUSTOM_OPTION}>{customLabel}</option>
    </select>
  );
}

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
