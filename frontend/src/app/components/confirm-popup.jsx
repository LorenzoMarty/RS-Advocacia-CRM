import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Button } from './ui/button';

export function ConfirmPopup({
  cancelLabel = 'Cancelar',
  confirmLabel = 'Confirmar',
  message,
  open,
  onCancel,
  onConfirm,
  title = 'Confirmar ação',
  tone = 'danger',
}) {
  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      onCancel();
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal forceMount>
        <AnimatePresence>
          {open ? (
            <Dialog.Overlay asChild forceMount>
              <Motion.div
                className="popup-layer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              />
            </Dialog.Overlay>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {open ? (
            <Dialog.Content asChild forceMount>
              <Motion.section
                className={cn('popup-panel rounded-xl', `popup-panel-${tone}`)}
                initial={{ opacity: 0, scale: 0.97, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="popup-mark" aria-hidden="true">
                  <AlertTriangle size={20} strokeWidth={1.9} />
                </div>

                <div className="popup-copy">
                  <p className="popup-kicker">Confirmação</p>
                  <Dialog.Title>{title}</Dialog.Title>
                  {message ? <Dialog.Description>{message}</Dialog.Description> : null}
                </div>

                <div className="popup-actions">
                  <Dialog.Close asChild>
                    <Button variant="secondary" type="button">
                      {cancelLabel}
                    </Button>
                  </Dialog.Close>
                  <Button
                    variant={tone === 'danger' ? 'destructive' : 'default'}
                    type="button"
                    onClick={onConfirm}
                  >
                    {confirmLabel}
                  </Button>
                </div>
              </Motion.section>
            </Dialog.Content>
          ) : null}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
