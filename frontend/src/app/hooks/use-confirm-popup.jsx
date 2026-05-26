import { useCallback, useEffect, useRef, useState } from 'react';

import { ConfirmPopup } from '../components/confirm-popup';

export function useConfirmPopup() {
  const [popupOptions, setPopupOptions] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const resolverRef = useRef(null);

  const closePopup = useCallback((confirmed) => {
    setIsOpen(false);
    window.setTimeout(() => {
      resolverRef.current?.(confirmed);
      resolverRef.current = null;
      setPopupOptions(null);
    }, confirmed ? 0 : 150);
  }, []);

  const confirm = useCallback((options) => {
    if (resolverRef.current) {
      resolverRef.current(false);
    }

    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setPopupOptions(options);
      setIsOpen(true);
    });
  }, []);

  useEffect(() => () => {
    resolverRef.current?.(false);
  }, []);

  const confirmPopup = popupOptions ? (
    <ConfirmPopup
      {...popupOptions}
      open={isOpen}
      onCancel={() => closePopup(false)}
      onConfirm={() => closePopup(true)}
    />
  ) : null;

  return { confirm, confirmPopup };
}
