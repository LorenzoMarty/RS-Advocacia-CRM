import { useEffect, useRef, useState } from 'react';

const CUSTOM_OPTION = '__custom__';

// Select com opção de digitar um valor novo (combobox).
// IMPORTANTE: o <select> nunca é desmontado durante o seu próprio onChange — apenas escondido
// (display:none) e o input é montado ao lado. Desmontar o <select> dentro do evento de seleção
// quebrava com `removeChild` (React tentava remover um nó que o navegador já mexeu).
export function ComboField({
  id,
  value,
  options,
  onChange,
  selectPlaceholder = 'Selecione',
  customLabel = '+ Digitar novo...',
  customPlaceholder = 'Digite o novo valor',
}) {
  const known = [...new Set([...(value ? [value] : []), ...options].filter(Boolean))];
  const [mode, setMode] = useState(() => (value && !options.filter(Boolean).includes(value) ? 'custom' : 'select'));
  const inputRef = useRef(null);

  useEffect(() => {
    if (mode === 'custom') {
      inputRef.current?.focus();
    }
  }, [mode]);

  const isCustom = mode === 'custom';

  return (
    <>
      <select
        id={id}
        value={value}
        style={isCustom ? { display: 'none' } : undefined}
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
      {isCustom ? (
        <div className="type-combo">
          <input
            ref={inputRef}
            id={`${id}-novo`}
            value={value}
            placeholder={customPlaceholder}
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
      ) : null}
    </>
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
