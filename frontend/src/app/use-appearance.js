import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_APPEARANCE, applyAppearance, readAppearance } from './preferences';

// Owns the appearance preference state, persistence and the open/close flag.
// The inline script in index.html already applied the saved values before mount;
// this keeps React as the authoritative source after the user interacts.
export function useAppearanceState() {
  const [appearance, setAppearance] = useState(readAppearance);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

  const setOption = useCallback((group, id) => {
    setAppearance((prev) => ({ ...prev, [group]: id }));
  }, []);

  const reset = useCallback(() => {
    setAppearance({ ...DEFAULT_APPEARANCE });
  }, []);

  return { appearance, setOption, reset, open, setOpen };
}
