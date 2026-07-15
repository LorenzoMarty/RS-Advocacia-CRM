import { createContext, Suspense, useContext, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';

import { AppearancePanel, AppearanceTrigger } from './components/appearance-panel';
import { useOnboardingLauncher } from './components/onboarding-launcher';
import { AnimatePresence, MotionPage } from './motion';
import { NAV_ITEMS } from './data';
import { useAppState } from './store';
import { useAppearanceState } from './use-appearance';
import { formatTime, normalizeText } from './utils';
import { useNotifications } from './hooks/use-notifications';

const PageChromeContext = createContext(() => {});
const PAGE_CHROME_DEFAULT = { label: 'Painel', actions: null };
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function createNavClass(isActive, baseClass) {
  return `${baseClass}${isActive ? ' active' : ''}`;
}

// Fallback do Suspense ao trocar de rota (download do chunk lazy da página).
// Fica só no conteúdo — a sidebar/shell do ProtectedLayout continua montada.
function RouteFallback() {
  return (
    <div className="route-fallback" aria-busy="true" aria-label="Carregando página">
      <div className="skeleton-stack">
        <span className="skeleton" style={{ height: 32, width: '40%' }} />
        <span className="skeleton" style={{ height: 140 }} />
        <span className="skeleton" style={{ height: 140 }} />
      </div>
    </div>
  );
}

function NavigationIcon({ icon }) {
  switch (icon) {
    case 'painel':
      return (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="8" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="15" width="7" height="6" rx="1.5" />
        </svg>
      );
    case 'clientes':
      return (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'processos':
      return (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8" />
          <path d="M8 17h6" />
        </svg>
      );
    case 'agenda':
      return (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h18" />
          <path d="M8 14h.01" />
          <path d="M12 14h.01" />
          <path d="M16 14h.01" />
          <path d="M8 18h.01" />
          <path d="M12 18h.01" />
        </svg>
      );
    case 'prazos':
      return (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 15h5" />
          <path d="m15 15 2 2 4-4" />
        </svg>
      );
    case 'peticoes':
      return (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h5" />
          <path d="M8 17h3" />
          <path d="m14 18 4-4 2 2-4 4h-2z" />
        </svg>
      );
    case 'reunioes':
      return (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <path d="M12 19v4" />
          <path d="M8 23h8" />
        </svg>
      );
    case 'produtividade':
      return (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'prospeccao':
      return (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="m7 14 4-4 3 3 5-6" />
          <path d="M19 7h-3" />
          <path d="M19 7v3" />
        </svg>
      );
    case 'financeiro':
      return (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
          <circle cx="12" cy="14" r="2" />
        </svg>
      );
    case 'auditoria':
      return (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
          <path d="M11 8v6" />
          <path d="M8 11h6" />
        </svg>
      );
    default:
      return (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="10" cy="7" r="4" />
          <path d="M20 8v6" />
          <path d="M17 11h6" />
        </svg>
      );
  }
}

export function PageChrome({ label, actions = null }) {
  const setChrome = useContext(PageChromeContext);

  useEffect(() => {
    setChrome({ label, actions });

    return () => {
      setChrome(PAGE_CHROME_DEFAULT);
    };
    // Actions are intentionally treated as route-level chrome and refreshed on mount/unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, setChrome]);

  return null;
}

export function PageSearch({
  value,
  onChange,
  placeholder = 'Buscar',
  label = 'Busca da página',
  inputProps = {},
}) {
  return (
    <div className="page-search-inline">
      <label className="page-search" aria-label={label}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input type="search" value={value} onChange={onChange} placeholder={placeholder} {...inputProps} />
      </label>
    </div>
  );
}

export function StatusBadge({ tone = 'gold', children, className = '' }) {
  const nextClassName = `${tone === 'gold' ? 'badge gold' : `status-badge ${tone}`}${className ? ` ${className}` : ''}`;
  return <span className={nextClassName}>{children}</span>;
}

function LoadingScreen() {
  return (
    <main className="loading-screen" aria-live="polite" aria-busy="true">
      <section className="loading-card" role="status">
        <div className="loading-mark" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v18" />
            <path d="m19 8 3 8a5 5 0 0 1-6 0z" />
            <path d="m5 8 3 8a5 5 0 0 1-6 0z" />
            <path d="M3 7h18" />
            <path d="M7 21h10" />
          </svg>
        </div>

        <div className="loading-copy">
          <span className="loading-kicker">RS Advocacia</span>
          <h1>Carregando sistema</h1>
          <p>Preparando agenda, processos, prazos e petições.</p>
        </div>

        <div className="loading-progress" aria-hidden="true">
          <span />
        </div>
      </section>
    </main>
  );
}

function useVisibleNavItems() {
  const { hasPermission } = useAppState();
  return NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission));
}

function SidebarNavigation() {
  const navItems = useVisibleNavItems();
  return (
    <nav className="nav" aria-label="Áreas do sistema">
      {navItems.map((item) => (
        <NavLink
          key={item.key}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => createNavClass(isActive, 'nav-link')}
          aria-label={item.label}
          title={item.label}
          data-tour={`nav-${item.key}`}
        >
          <span className="nav-icon" aria-hidden="true">
            <NavigationIcon icon={item.key} />
          </span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function BottomNavigation() {
  const navItems = useVisibleNavItems();
  return (
    <div className="bottom-nav-shell" aria-hidden="false">
      <nav className="bottom-nav" aria-label="Navegação principal">
        <div className="bottom-nav-track">
          {navItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => createNavClass(isActive, 'bottom-nav-link')}
              aria-label={item.label}
              title={item.label}
            >
              <span className="bottom-nav-pill">
                <span className="bottom-nav-icon" aria-hidden="true">
                  <NavigationIcon icon={item.key} />
                </span>
                <span className="bottom-nav-label">{item.mobileLabel}</span>
              </span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}


function localDateOnly(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysUntil(value, today = new Date()) {
  const targetDate = localDateOnly(value);
  const todayDate = localDateOnly(today);

  if (Number.isNaN(targetDate.getTime())) {
    return null;
  }

  return Math.round((targetDate.getTime() - todayDate.getTime()) / DAY_IN_MS);
}

function reminderLabelForDays(days) {
  if (days === 0) {
    return 'hoje';
  }

  if (days === 1) {
    return 'amanhã';
  }

  return `em ${days} dias`;
}

function isFinishedTask(item) {
  const status = normalizeText(item.status);
  return item.completed || status.includes('conclu') || status.includes('protocolado') || status.includes('cancel');
}

function reminderStorageKey(userId) {
  const today = localDateOnly();
  const keyDate = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  return `rs-advocacia-reminders-${userId || 'anon'}-${keyDate}`;
}

function useReminderToasts({ addFlash, currentUser, deadlines, events, isLoading }) {
  useEffect(() => {
    if (isLoading || !currentUser) {
      return;
    }

    const storageKey = reminderStorageKey(currentUser.id);

    if (sessionStorage.getItem(storageKey)) {
      return;
    }

    const upcomingDeadlines = deadlines
      .map((deadline) => ({ ...deadline, days: daysUntil(deadline.date) }))
      .filter((deadline) => deadline.days !== null && deadline.days >= 0 && deadline.days <= 3 && !isFinishedTask(deadline));

    const tomorrowEvents = events
      .map((event) => ({ ...event, days: daysUntil(event.start) }))
      .filter((event) => event.days === 1 && !isFinishedTask(event));

    if (upcomingDeadlines.length === 1) {
      const [deadline] = upcomingDeadlines;
      addFlash(`Prazo chegando: ${deadline.title || 'prazo'} vence ${reminderLabelForDays(deadline.days)}.`, 'warning', { duration: 6200 });
    } else if (upcomingDeadlines.length > 1) {
      addFlash(`${upcomingDeadlines.length} prazos vencem nos próximos 3 dias.`, 'warning', { duration: 6200 });
    }

    if (tomorrowEvents.length === 1) {
      const [event] = tomorrowEvents;
      addFlash(`Compromisso amanhã: ${event.title} às ${formatTime(event.start)}.`, 'info', { duration: 6200 });
    } else if (tomorrowEvents.length > 1) {
      addFlash(`${tomorrowEvents.length} compromissos marcados para amanhã.`, 'info', { duration: 6200 });
    }

    sessionStorage.setItem(storageKey, 'shown');
  }, [addFlash, currentUser, deadlines, events, isLoading]);
}

function useShellPreferences() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('rs-advocacia-sidebar-collapsed') === 'true');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('data-sidebar-collapsed', sidebarCollapsed ? 'true' : 'false');
    localStorage.setItem('rs-advocacia-sidebar-collapsed', sidebarCollapsed ? 'true' : 'false');
  }, [sidebarCollapsed]);

  return {
    sidebarCollapsed,
    toggleSidebar: () => {
      if (window.innerWidth <= 1200) {
        return;
      }

      setSidebarCollapsed((currentState) => !currentState);
    },
  };
}

export function GuestLayout() {
  const { currentUser, isLoading } = useAppState();

  useEffect(() => {
    document.body.classList.add('login-body');
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.removeAttribute('data-sidebar-collapsed');

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', '#0b0d12');
    }

    return () => {
      document.body.classList.remove('login-body');
    };
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

function formatRelTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  if (h < 48) return 'ontem';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(iso));
}

function NotifTypeIcon({ tipo }) {
  if (tipo === 'prazo') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  );
  if (tipo === 'evento') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
  if (tipo === 'reuniao') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" />
    </svg>
  );
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M12 8h.01M12 12v4" />
    </svg>
  );
}

function ProfileMenu({ onOpenAppearance, onStartTour }) {
  const { currentUser, currentRole, sair } = useAppState();
  const { notificacoes, totalNaoLidas, marcarLida, marcarTodasLidas } = useNotifications();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  function handleAction(fn) {
    setOpen(false);
    fn?.();
  }

  return (
    <div className="profile-menu" ref={menuRef}>
      <button
        type="button"
        className="profile sidebar-profile sidebar-profile-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Menu do usuário${totalNaoLidas ? ` — ${totalNaoLidas} notificações` : ''}`}
        onClick={() => setOpen((p) => !p)}
      >
        <div className="avatar" aria-hidden="true">
          {currentUser.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="profile-copy">
          <strong>{currentUser.name}</strong>
          <span>{currentRole?.name || 'Usuário'}</span>
        </div>
        {totalNaoLidas > 0 && (
          <span className="profile-notif-badge" aria-hidden="true">
            {totalNaoLidas > 9 ? '9+' : totalNaoLidas}
          </span>
        )}
        <svg
          className={`profile-chevron${open ? ' is-open' : ''}`}
          width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>

      {open && (
        <div className="profile-dropdown" role="dialog" aria-label="Menu do usuário">
          {/* Notifications */}
          <div className="notification-header">
            <strong>Notificações</strong>
            {totalNaoLidas > 0 && (
              <button type="button" className="notification-mark-all" onClick={marcarTodasLidas}>
                Marcar todas lidas
              </button>
            )}
          </div>

          {notificacoes.length === 0 ? (
            <div className="notification-empty">Sem notificações pendentes.</div>
          ) : (
            <ul className="notification-list" role="list">
              {notificacoes.map((n) => (
                <li key={n.id} className={`notification-item notif-tipo-${n.tipo || 'sistema'}`}>
                  <span className="notification-type-icon">
                    <NotifTypeIcon tipo={n.tipo} />
                  </span>
                  <div className="notification-content">
                    <strong className="notification-title">{n.titulo}</strong>
                    {n.mensagem && <p className="notification-msg">{n.mensagem}</p>}
                    {n.criada_em && (
                      <time className="notification-time" dateTime={n.criada_em}>
                        {formatRelTime(n.criada_em)}
                      </time>
                    )}
                  </div>
                  <button
                    type="button"
                    className="notification-dismiss"
                    aria-label="Marcar como lida"
                    onClick={() => marcarLida(n.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="profile-dropdown-sep" />

          <nav className="profile-dropdown-actions" aria-label="Ações do usuário">
            {onOpenAppearance && (
              <button type="button" className="profile-dropdown-action" onClick={() => handleAction(onOpenAppearance)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
                Aparência
              </button>
            )}
            {onStartTour && (
              <button
                type="button"
                className="profile-dropdown-action"
                data-tour="rever-tour"
                onClick={() => handleAction(onStartTour)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.5 9a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2-2.4 3.6" />
                  <path d="M12 17h.01" />
                </svg>
                Rever tour
              </button>
            )}
            <button
              type="button"
              className="profile-dropdown-action profile-dropdown-action--danger"
              onClick={() => handleAction(sair)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m16 17 5-5-5-5M21 12H9M13 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
              </svg>
              Sair
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}

export function ProtectedLayout() {
  const { addFlash, currentUser, deadlines, events, isLoading } = useAppState();
  const location = useLocation();
  const [, setChrome] = useState(PAGE_CHROME_DEFAULT);
  const { sidebarCollapsed, toggleSidebar } = useShellPreferences();
  const appearance = useAppearanceState();
  const { startTour, hasTour } = useOnboardingLauncher();

  useReminderToasts({ addFlash, currentUser, deadlines, events, isLoading });

  useEffect(() => {
    document.body.classList.remove('login-body');
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <PageChromeContext.Provider value={setChrome}>
      <a href="#main-content" className="skip-link">Ir para o conteúdo</a>
      <div className="shell">
        <aside className="sidebar" id="app-sidebar" aria-label="Navegação principal">
          <button
            className="sidebar-toggle-clean"
            type="button"
            aria-controls="app-sidebar"
            aria-expanded={sidebarCollapsed ? 'false' : 'true'}
            aria-label={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            title={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            onClick={toggleSidebar}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>

          <div className="sidebar-scroll">
            <Link className="brand" to="/" aria-label="Ir para a área inicial" title="Início">
              <div className="brand-mark" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v18" />
                  <path d="m19 8 3 8a5 5 0 0 1-6 0z" />
                  <path d="m5 8 3 8a5 5 0 0 1-6 0z" />
                  <path d="M3 7h18" />
                  <path d="M7 21h10" />
                </svg>
              </div>
              <div className="brand-copy">
                <strong>RS Advocacia</strong>
              </div>
            </Link>

            <SidebarNavigation />
          </div>

          <div className="sidebar-footer">
            <ProfileMenu
              onOpenAppearance={() => appearance.setOpen(true)}
              onStartTour={hasTour ? startTour : undefined}
            />
          </div>
        </aside>

        <div className="page">
          <div className="page-wrap">
            <main className="main" id="main-content">
              <Suspense fallback={<RouteFallback />}>
                <AnimatePresence mode="wait" initial={false}>
                  <MotionPage key={location.pathname} className="page-motion">
                    <Outlet />
                  </MotionPage>
                </AnimatePresence>
              </Suspense>
            </main>
          </div>
        </div>
      </div>

      <AppearanceTrigger
        className="appearance-fab"
        label="Aparência"
        onOpen={() => appearance.setOpen(true)}
      />

      <AppearancePanel
        appearance={appearance.appearance}
        setOption={appearance.setOption}
        reset={appearance.reset}
        open={appearance.open}
        onClose={() => appearance.setOpen(false)}
      />

      <BottomNavigation />
      <Toaster
        theme="dark"
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{
          style: {
            background: 'rgba(15,23,42,.98)',
            border: '1px solid rgba(148,163,184,.16)',
            color: '#e5e7eb',
            fontFamily: 'var(--sans)',
          },
        }}
      />
    </PageChromeContext.Provider>
  );
}
