import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './onboarding.css';

const WAIT_TIMEOUT_MS = 2500;
const WAIT_INTERVAL_MS = 50;

function currentPath() {
  return window.location.hash.replace(/^#/, '') || '/';
}

function waitForElement(selector) {
  return new Promise((resolve) => {
    const start = Date.now();
    (function poll() {
      const element = document.querySelector(selector);
      if (element || Date.now() - start > WAIT_TIMEOUT_MS) {
        resolve(element);
        return;
      }
      setTimeout(poll, WAIT_INTERVAL_MS);
    })();
  });
}

// Tour com passos que podem viver em páginas diferentes: quando um passo tem
// `route`, navega até lá antes de destacar o elemento (a lib driver.js só sabe
// destacar elementos já presentes no DOM).
export function useOnboardingTour() {
  const navigate = useNavigate();

  const start = useCallback(
    (steps, onComplete) => {
      if (!steps?.length) return null;

      let driverObj;

      async function goToStep(index) {
        if (index < 0) return;
        if (index >= steps.length) {
          driverObj.destroy();
          return;
        }
        const step = steps[index];
        if (step.route && step.route !== currentPath()) {
          navigate(step.route);
          await waitForElement(step.element);
        }
        driverObj.drive(index);
      }

      driverObj = driver({
        showProgress: true,
        allowClose: true,
        overlayOpacity: 0.55,
        animate: true,
        popoverClass: 'onboarding-popover',
        nextBtnText: 'Próximo',
        prevBtnText: 'Voltar',
        doneBtnText: 'Concluir',
        progressText: '{{current}} de {{total}}',
        steps: steps.map((step) => ({ element: step.element, popover: step.popover })),
        onDestroyed: () => onComplete?.(),
        onNextClick: (_element, _step, opts) => goToStep(opts.state.activeIndex + 1),
        onPrevClick: (_element, _step, opts) => goToStep(opts.state.activeIndex - 1),
      });

      goToStep(0);
      return driverObj;
    },
    [navigate],
  );

  return { start };
}
