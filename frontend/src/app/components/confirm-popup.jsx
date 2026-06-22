import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../hooks/use-focus-trap';

export function ConfirmPopup({
  cancelLabel = 'Cancelar',
  confirmLabel = 'Confirmar',
  message,
  onCancel,
  onConfirm,
  title = 'Confirmar ação',
  tone = 'danger',
}) {
  const cancelButtonRef = useRef(null);
  const panelRef = useRef(null);
  useFocusTrap(panelRef);

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onCancel();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  function handleLayerClick(event) {
    if (event.target === event.currentTarget) {
      onCancel();
    }
  }

  return createPortal(
    <div
      className="popup-layer"
      role="presentation"
      onMouseDown={handleLayerClick}
    >
      <section
        ref={panelRef}
        aria-labelledby="confirm-popup-title"
        aria-modal="true"
        className={`popup-panel popup-panel-${tone}`}
        role="dialog"
      >
        <div className="popup-mark" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
        </div>

        <div className="popup-copy">
          <p className="popup-kicker">Confirmação</p>
          <h2 id="confirm-popup-title">{title}</h2>
          {message ? <p>{message}</p> : null}
        </div>

        <div className="popup-actions">
          <button
            className="btn btn-secondary"
            type="button"
            ref={cancelButtonRef}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className={`btn${tone === 'danger' ? ' btn-danger' : ''}`}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
