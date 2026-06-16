import {
  Children,
  forwardRef,
  isValidElement,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

// Componente React que substitui o <select> nativo pela UI custom dourada (classes .rs-select-*
// já estilizadas em styles/components/forms.css). Renderiza dentro do ciclo do React — sem mover
// nós da DOM, sem race, sem "revert" para o visual nativo. Substitui o antigo lib/premium-select.js.
//
// Drop-in: aceita os mesmos props/children de um <select> (value/onChange controlado, ou
// {...register(...)} do react-hook-form via ref). O <select> nativo continua na DOM como fonte de
// verdade (escondido), garantindo semântica de form, value e o contrato onChange(event).

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 4.2 4.2L19 6.4" />
    </svg>
  );
}

// Achata os children (<option>/<optgroup>) em uma estrutura usada para render e para o label.
function readOptions(children) {
  const flat = [];
  const groups = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }

    if (child.type === 'optgroup') {
      const groupOptions = [];
      Children.forEach(child.props.children, (option) => {
        if (isValidElement(option) && option.type === 'option') {
          const entry = optionEntry(option);
          groupOptions.push(entry);
          flat.push(entry);
        }
      });
      groups.push({ kind: 'group', label: child.props.label, options: groupOptions });
      return;
    }

    if (child.type === 'option') {
      const entry = optionEntry(child);
      groups.push({ kind: 'option', option: entry });
      flat.push(entry);
    }
  });

  return { flat, groups };
}

function optionEntry(option) {
  const value = option.props.value !== undefined ? String(option.props.value) : textOf(option.props.children);
  return {
    value,
    label: textOf(option.props.children),
    disabled: Boolean(option.props.disabled),
    hidden: Boolean(option.props.hidden),
  };
}

function textOf(children) {
  return Children.toArray(children)
    .map((node) => (typeof node === 'string' || typeof node === 'number' ? String(node) : ''))
    .join('')
    .trim();
}

export const Select = forwardRef(function Select(
  { className = '', children, placeholder = 'Selecionar', onChange, ...rest },
  forwardedRef,
) {
  const generatedId = useId();
  const shellId = rest.id || generatedId;
  const nativeRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState('bottom');
  const [currentValue, setCurrentValue] = useState('');

  const { flat, groups } = readOptions(children);
  const selected = flat.find((entry) => entry.value === currentValue) || null;
  const isEmpty = !selected || selected.value === '';
  const disabled = Boolean(rest.disabled);

  const setNativeRef = (node) => {
    nativeRef.current = node;
    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  };

  // Espelha o valor vivo do <select> nativo (cobre controlado via value e não-controlado via RHF).
  // Roda a cada render; o guard (value !== currentValue) evita loop de atualização.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const node = nativeRef.current;
    if (node && node.value !== currentValue) {
      setCurrentValue(node.value);
    }
  });

  function syncFromNative() {
    const node = nativeRef.current;
    if (node) {
      setCurrentValue(node.value);
    }
  }

  function commitValue(value) {
    const node = nativeRef.current;
    if (!node || node.value === value) {
      closeDropdown();
      return;
    }
    node.value = value;
    setCurrentValue(value);
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
    closeDropdown();
  }

  function positionDropdown() {
    const trigger = triggerRef.current;
    const dropdown = dropdownRef.current;
    if (!trigger || !dropdown) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const dropdownWidth = Math.min(rect.width, viewportWidth - 16);
    const spaceBelow = viewportHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const nextSide = spaceBelow < 220 && spaceAbove > spaceBelow ? 'top' : 'bottom';
    const availableHeight = Math.max(132, Math.min(nextSide === 'bottom' ? spaceBelow : spaceAbove, 320));

    setSide(nextSide);
    dropdown.style.width = `${dropdownWidth}px`;
    dropdown.style.setProperty('--rs-select-max-height', `${availableHeight}px`);
    const left = Math.min(Math.max(8, rect.left), viewportWidth - dropdownWidth - 8);
    dropdown.style.left = `${left}px`;
    const dropdownHeight = dropdown.offsetHeight;
    const top = nextSide === 'bottom' ? rect.bottom + 8 : rect.top - dropdownHeight - 8;
    dropdown.style.top = `${Math.max(8, top)}px`;
  }

  function openDropdown() {
    if (disabled) {
      return;
    }
    setOpen(true);
  }

  function closeDropdown() {
    setOpen(false);
  }

  function toggleDropdown() {
    if (open) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  // Posiciona quando abre; fecha em scroll/resize e em clique fora.
  useLayoutEffect(() => {
    if (!open) {
      return undefined;
    }
    positionDropdown();

    const handlePointerDown = (event) => {
      const trigger = triggerRef.current;
      const dropdown = dropdownRef.current;
      if (trigger && trigger.contains(event.target)) {
        return;
      }
      if (dropdown && dropdown.contains(event.target)) {
        return;
      }
      closeDropdown();
    };
    const handleScroll = (event) => {
      const dropdown = dropdownRef.current;
      if (dropdown && dropdown.contains(event.target)) {
        return;
      }
      closeDropdown();
    };
    const handleResize = () => closeDropdown();

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [open]);

  const enabledValues = flat.filter((entry) => !entry.disabled && !entry.hidden).map((entry) => entry.value);

  function moveSelection(direction) {
    if (!enabledValues.length) {
      return;
    }
    const index = enabledValues.indexOf(currentValue);
    const nextIndex = index === -1
      ? (direction > 0 ? 0 : enabledValues.length - 1)
      : Math.min(Math.max(index + direction, 0), enabledValues.length - 1);
    commitValue(enabledValues[nextIndex]);
  }

  function handleTriggerKeyDown(event) {
    if (disabled) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (open) {
        moveSelection(1);
      } else {
        openDropdown();
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (open) {
        moveSelection(-1);
      } else {
        openDropdown();
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleDropdown();
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      closeDropdown();
    }
  }

  const ariaLabel = rest['aria-label'];

  return (
    <div className={`rs-select${open ? ' is-open' : ''}${isEmpty ? ' is-empty' : ''}${disabled ? ' is-disabled' : ''}`}>
      <select
        {...rest}
        ref={setNativeRef}
        onChange={(event) => {
          syncFromNative();
          if (onChange) {
            onChange(event);
          }
        }}
        onFocus={(event) => {
          if (triggerRef.current) {
            triggerRef.current.focus();
          }
          if (rest.onFocus) {
            rest.onFocus(event);
          }
        }}
        className={`rs-native-select${className ? ` ${className}` : ''}`}
        tabIndex={-1}
        aria-hidden="true"
      >
        {children}
      </select>

      <button
        type="button"
        ref={triggerRef}
        className="rs-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${shellId}-dropdown`}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={toggleDropdown}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="rs-select-value">{selected ? selected.label : placeholder}</span>
        <span className="rs-select-icon"><ChevronIcon /></span>
      </button>

      {createPortal(
        <div
          ref={dropdownRef}
          id={`${shellId}-dropdown`}
          className={`rs-select-dropdown${open ? ' is-open' : ''}`}
          data-side={side}
          hidden={!open}
          role="presentation"
        >
          <div className="rs-select-list" role="listbox" aria-label={ariaLabel}>
            {flat.length === 0 ? (
              <div className="rs-select-empty-state">Sem opções disponíveis.</div>
            ) : (
              groups.map((node, index) => {
                if (node.kind === 'group') {
                  return (
                    <div className="rs-select-group" key={`group-${index}`}>
                      <div className="rs-select-group-label">{node.label}</div>
                      {node.options.map((option) => (
                        <Option
                          key={option.value}
                          option={option}
                          selected={option.value === currentValue}
                          onPick={commitValue}
                        />
                      ))}
                    </div>
                  );
                }
                return (
                  <Option
                    key={node.option.value}
                    option={node.option}
                    selected={node.option.value === currentValue}
                    onPick={commitValue}
                  />
                );
              })
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
});

function Option({ option, selected, onPick }) {
  if (option.hidden) {
    return null;
  }
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      className={`rs-select-option${selected ? ' is-selected' : ''}${option.disabled ? ' is-disabled' : ''}`}
      onClick={() => {
        if (!option.disabled) {
          onPick(option.value);
        }
      }}
    >
      <span className="rs-select-option-copy">
        <span className="rs-select-option-text">{option.label}</span>
      </span>
      <span className="rs-select-option-mark"><CheckIcon /></span>
    </button>
  );
}

export default Select;
