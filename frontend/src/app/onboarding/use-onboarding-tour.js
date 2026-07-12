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

// Páginas entram com animação (framer-motion): o botão só chega na posição
// final alguns ms depois de montar. Espera o retângulo do elemento parar de
// mudar antes de deixar o driver.js medir onde destacar.
function waitForStablePosition(element) {
  return new Promise((resolve) => {
    let lastRect = element.getBoundingClientRect();
    let stableTicks = 0;
    let checks = 0;
    const interval = setInterval(() => {
      checks += 1;
      const rect = element.getBoundingClientRect();
      const moved = Math.abs(rect.top - lastRect.top) > 0.5 || Math.abs(rect.left - lastRect.left) > 0.5;
      lastRect = rect;
      stableTicks = moved ? 0 : stableTicks + 1;
      if (stableTicks >= 2 || checks >= 20) {
        clearInterval(interval);
        resolve();
      }
    }, 30);
  });
}

// Tour com passos que podem viver em páginas diferentes: quando um passo tem
// `route`, navega até lá antes de destacar o elemento (a lib driver.js só sabe
// destacar elementos já presentes no DOM).
export function useOnboardingTour() {
  const navigate = useNavigate();

  const start = useCallback(
    (steps, onProgress, startIndex = 0) => {
      if (!steps?.length) return null;

      let driverObj;
      let lastActiveIndex = Math.min(Math.max(startIndex, 0), steps.length - 1);
      let completedNaturally = false;

      async function goToStep(index) {
        if (index < 0) return;
        if (index >= steps.length) {
          completedNaturally = true;
          driverObj.destroy();
          return;
        }
        lastActiveIndex = index;
        const step = steps[index];
        if (step.route && step.route !== currentPath()) {
          navigate(step.route);
          const element = await waitForElement(step.element);
          if (element) await waitForStablePosition(element);
        }
        driverObj.drive(index);
        driverObj.refresh();
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
        onDestroyed: () => onProgress?.(lastActiveIndex, completedNaturally),
        onNextClick: (_element, _step, opts) => goToStep(opts.state.activeIndex + 1),
        onPrevClick: (_element, _step, opts) => goToStep(opts.state.activeIndex - 1),
      });

      goToStep(lastActiveIndex);
      return driverObj;
    },
    [navigate],
  );

  return { start };
}
