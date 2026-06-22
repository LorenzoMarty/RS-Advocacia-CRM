import { createContext, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';

import { AppearancePanel, AppearanceTrigger } from './components/appearance-panel';
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

function NotificationBell() {
  const { notificacoes, totalNaoLidas, marcarLida, marcarTodasLidas } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="notification-bell" style={{ position: 'relative' }}>
      <button
        type="button"
        className="nav-link"
        aria-label={`Notificações${totalNaoLidas ? ` (${totalNaoLidas} não lidas)` : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        style={{ position: 'relative' }}
      >
        <span className="nav-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </span>
        {totalNaoLidas > 0 && (
          <span className="notification-badge" aria-hidden="true">{totalNaoLidas > 9 ? '9+' : totalNaoLidas}</span>
        )}
      </button>

      {open && (
        <div
          className="notification-dropdown"
          role="dialog"
          aria-label="Notificações"
        >
          <div className="notification-header">
            <strong>Notificações</strong>
            {totalNaoLidas > 0 && (
              <button type="button" className="notification-mark-all" onClick={marcarTodasLidas}>
                Marcar todas como lidas
              </button>
            )}
          </div>

          {notificacoes.length === 0 ? (
            <div className="notification-empty">Nenhuma notificação pendente.</div>
          ) : (
            <ul className="notification-list" role="list">
              {notificacoes.map((n) => (
                <li key={n.id} className="notification-item">
                  <div className="notification-content">
                    <strong className="notification-title">{n.titulo}</strong>
                    {n.mensagem && <p className="notification-msg">{n.mensagem}</p>}
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
        </div>
      )}
    </div>
  );
}

export function ProtectedLayout() {
  const { addFlash, currentUser, deadlines, events, isLoading, sair } = useAppState();
  const location = useLocation();
  const [, setChrome] = useState(PAGE_CHROME_DEFAULT);
  const { sidebarCollapsed, toggleSidebar } = useShellPreferences();
  const appearance = useAppearanceState();

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

            <div className="sidebar-footer">
              <div className="profile sidebar-profile">
                <div className="avatar">{currentUser.name.slice(0, 1).toUpperCase()}</div>
                <div className="profile-copy">
                  <strong>{currentUser.name}</strong>
                  <span>{new Intl.DateTimeFormat('pt-BR').format(new Date())}</span>
                </div>
              </div>

              <NotificationBell />

              <AppearanceTrigger
                className="nav-link sidebar-appearance"
                label="Aparência"
                onOpen={() => appearance.setOpen(true)}
              />

              <button className="nav-link sidebar-logout" type="button" aria-label="Sair" title="Sair" onClick={sair}>
                <span className="nav-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m16 17 5-5-5-5" />
                    <path d="M21 12H9" />
                    <path d="M13 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
        </aside>

        <div className="page">
          <div className="page-wrap">
            <main className="main" id="main-content">
              <AnimatePresence mode="wait" initial={false}>
                <MotionPage key={location.pathname} className="page-motion">
                  <Outlet />
                </MotionPage>
              </AnimatePresence>
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
