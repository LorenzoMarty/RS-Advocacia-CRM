import { useCallback, useEffect, useRef, useState } from 'react';

import { ConfirmPopup } from '../components/confirm-popup';

export function useConfirmPopup() {
  const [popupOptions, setPopupOptions] = useState(null);
  const resolverRef = useRef(null);

  const closePopup = useCallback((confirmed) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setPopupOptions(null);
  }, []);

  const confirm = useCallback((options) => {
    if (resolverRef.current) {
      resolverRef.current(false);
    }

    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setPopupOptions(options);
    });
  }, []);

  useEffect(() => () => {
    resolverRef.current?.(false);
  }, []);

  const confirmPopup = popupOptions ? (
    <ConfirmPopup
      {...popupOptions}
      onCancel={() => closePopup(false)}
      onConfirm={() => closePopup(true)}
    />
  ) : null;

  return { confirm, confirmPopup };
}
