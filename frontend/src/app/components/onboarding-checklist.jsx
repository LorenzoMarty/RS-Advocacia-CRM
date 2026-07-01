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

  const total = items.length;
  const doneCount = completed.length;
  const progress = Math.round((doneCount / total) * 100);

  return (
    <article className="surface rail onboarding-checklist">
      <div className="section-head">
        <div>
          <h2 className="section-title">Primeiros passos</h2>
          <p className="section-note">
            {doneCount} de {total} concluídos
          </p>
        </div>
        <button
          type="button"
          className="onboarding-dismiss"
          onClick={dismiss}
          aria-label="Ocultar checklist de primeiros passos"
          title="Ocultar checklist"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div
        className="onboarding-progress-track"
        role="progressbar"
        aria-valuenow={doneCount}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Progresso dos primeiros passos"
      >
        <div className="onboarding-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="rail-group onboarding-item-list">
        {items.map((item) => {
          const done = completed.includes(item.id);
          return (
            <div className={done ? 'onboarding-item is-done' : 'onboarding-item'} key={item.id}>
              <button
                type="button"
                className="onboarding-item-check"
                onClick={() => toggle(item.id)}
                aria-pressed={done}
                aria-label={done ? `Marcar "${item.label}" como não concluído` : `Marcar "${item.label}" como concluído`}
              >
                {done && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
              <Link to={item.route} className="onboarding-item-label">
                {item.label}
              </Link>
            </div>
          );
        })}
      </div>
    </article>
  );
}
