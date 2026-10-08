import { useEffect, useRef } from 'react';

import { APPEARANCE, APPEARANCE_GROUPS } from '../preferences';
import { useFocusTrap } from '../hooks/use-focus-trap';

export function AppearancePanel({ appearance, setOption, reset, open, onClose }) {
  const panelRef = useRef(null);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="popup-layer appearance-layer"
      role="dialog"
      aria-modal="true"
      aria-label="Preferências de aparência"
      onClick={onClose}
    >
      <div ref={panelRef} className="popup-panel appearance-panel" onClick={(event) => event.stopPropagation()}>
        <div className="appearance-head">
          <div className="popup-copy">
            <p className="popup-kicker">Aparência</p>
            <h2>Ajuste a interface</h2>
            <p>Tema, escala, fonte e espaçamento. As escolhas ficam salvas neste navegador.</p>
          </div>
          <button type="button" className="appearance-close" onClick={onClose} aria-label="Fechar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="appearance-groups">
          {APPEARANCE_GROUPS.map((group) => {
            const config = APPEARANCE[group];
            const current = appearance[group] || config.default;
            return (
              <div className="appearance-group" key={group}>
                <span className="appearance-group-label">{config.label}</span>
                <div className="appearance-segment" role="group" aria-label={config.label}>
                  {config.presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`appearance-segment-item${current === preset.id ? ' is-active' : ''}`}
                      aria-pressed={current === preset.id}
                      onClick={() => setOption(group, preset.id)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="appearance-actions">
          <button type="button" className="btn btn-secondary" onClick={reset}>
            Restaurar padrão
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
