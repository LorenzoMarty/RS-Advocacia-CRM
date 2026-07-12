import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppState } from '../store';
import { ROLE_TOUR_KEY, TOURS } from '../onboarding/tours.config';
import { useOnboardingProgress } from '../onboarding/use-onboarding-progress';
import { useOnboardingTour } from '../onboarding/use-onboarding-tour';

// Dispara o tour automaticamente na 1ª visita ao dashboard e expõe `startTour`
// para um botão manual ("Rever tour") em qualquer lugar do app.
export function useOnboardingLauncher() {
  const { currentUser, currentRole, isLoading } = useAppState();
  const location = useLocation();
  const { start } = useOnboardingTour();
  const roleKey = ROLE_TOUR_KEY[currentRole?.name];
  const steps = TOURS[roleKey] ?? [];
  const { tourSeen, resumeStep, saveProgress } = useOnboardingProgress(currentUser?.id);

  useEffect(() => {
    if (isLoading || !currentUser || !steps.length || tourSeen) return;
    if (location.pathname !== '/') return;
    const timer = setTimeout(() => start(steps, saveProgress, resumeStep), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, isLoading, location.pathname, tourSeen]);

  return {
    hasTour: Boolean(currentUser && steps.length),
    startTour: () => start(steps, saveProgress, resumeStep),
  };
}
