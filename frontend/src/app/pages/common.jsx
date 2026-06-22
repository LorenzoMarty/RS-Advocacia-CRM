import { useEffect, useRef, useState } from 'react';

import { AnimatePresence, motion as Motion } from '../motion';
import { Select } from '../components/select';

const CUSTOM_OPTION = '__custom__';

const FIELD_ERROR_MOTION = {
  initial: { opacity: 0, y: -4, height: 0 },
  animate: { opacity: 1, y: 0, height: 'auto' },
  exit: { opacity: 0, y: -4, height: 0 },
  transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
};

// Select com opção de digitar um valor novo (combobox). Usa o <Select> custom; no modo "custom"
// renderiza um input no lugar. O <Select> é um componente React (sem manipulação imperativa da DOM),
// então alternar entre os dois modos é seguro — sem o antigo problema de removeChild.
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

  return isCustom ? (
    <div className="type-combo">
      <input
        ref={inputRef}
        id={id}
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
  ) : (
    <Select
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
    </Select>
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
      <AnimatePresence initial={false}>
        {error ? (
          <Motion.div
            key="field-error"
            className="field-error"
            role="alert"
            style={{ overflow: 'hidden' }}
            {...FIELD_ERROR_MOTION}
          >
            {error}
          </Motion.div>
        ) : null}
      </AnimatePresence>
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
