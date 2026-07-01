import { useCallback } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './onboarding.css';

export function useOnboardingTour() {
  const start = useCallback((steps, onComplete) => {
    if (!steps?.length) return null;
    const instance = driver({
      showProgress: true,
      allowClose: true,
      overlayOpacity: 0.55,
      animate: true,
      popoverClass: 'onboarding-popover',
      nextBtnText: 'Próximo',
      prevBtnText: 'Voltar',
      doneBtnText: 'Concluir',
      progressText: '{{current}} de {{total}}',
      steps,
      onDestroyed: () => onComplete?.(),
    });
    instance.drive();
    return instance;
  }, []);

  return { start };
}
