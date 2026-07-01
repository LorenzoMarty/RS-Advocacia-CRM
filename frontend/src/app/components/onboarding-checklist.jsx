import { Link } from 'react-router-dom';
import { useAppState } from '../store';
import { CHECKLIST_ITEMS } from '../onboarding/checklist.config';
import { ROLE_TOUR_KEY } from '../onboarding/tours.config';
import { useOnboardingProgress } from '../onboarding/use-onboarding-progress';

export function OnboardingChecklist() {
  const { currentUser, currentRole } = useAppState();
  const roleKey = ROLE_TOUR_KEY[currentRole?.name];
  const items = CHECKLIST_ITEMS[roleKey] ?? [];
  const { completed, dismissed, toggle, dismiss } = useOnboardingProgress(currentUser?.id);

  if (!items.length || dismissed || completed.length === items.length) return null;

  return (
    <section className="onboarding-checklist" aria-label="Primeiros passos">
      <h2>Primeiros passos</h2>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <label>
              <input
                type="checkbox"
                checked={completed.includes(item.id)}
                onChange={() => toggle(item.id)}
              />
              <Link to={item.route}>{item.label}</Link>
            </label>
          </li>
        ))}
      </ul>
      <button type="button" className="btn-secondary" onClick={dismiss}>
        Ocultar checklist
      </button>
    </section>
  );
}
