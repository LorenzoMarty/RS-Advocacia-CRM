import { createContext, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';

import { NAV_ITEMS } from './data';
import { useAppState } from './store';

const PageChromeContext = createContext(() => {});
const PAGE_CHROME_DEFAULT = { label: 'Painel', actions: null };

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

function SidebarNavigation() {
  return (
    <nav className="nav" aria-label="Áreas do sistema">
      {NAV_ITEMS.map((item) => (
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
  return (
    <div className="bottom-nav-shell" aria-hidden="false">
      <nav className="bottom-nav" aria-label="Navegação principal">
        <div className="bottom-nav-track">
          {NAV_ITEMS.map((item) => (
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

function FlashMessages() {
  const { flashes, removeFlash } = useAppState();

  if (!flashes.length) {
    return null;
  }

  return (
    <div className="flash-stack" aria-live="polite" aria-label="Mensagens do sistema">
      {flashes.map((flash) => (
        <button
          key={flash.id}
          type="button"
          className={`flash flash-${flash.type}`}
          onClick={() => removeFlash(flash.id)}
        >
          {flash.message}
        </button>
      ))}
    </div>
  );
}

function useShellPreferences() {
  const [theme, setTheme] = useState(() => localStorage.getItem('rs-advocacia-theme') || 'dark');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('rs-advocacia-sidebar-collapsed') === 'true');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-sidebar-collapsed', sidebarCollapsed ? 'true' : 'false');
    localStorage.setItem('rs-advocacia-theme', theme);
    localStorage.setItem('rs-advocacia-sidebar-collapsed', sidebarCollapsed ? 'true' : 'false');

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', theme === 'light' ? '#f3ede3' : '#0b0d12');
    }
  }, [sidebarCollapsed, theme]);

  return {
    sidebarCollapsed,
    toggleTheme: () => setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light')),
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
    return null;
  }

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function ProtectedLayout() {
  const { currentUser, isLoading, sair } = useAppState();
  const location = useLocation();
  const [chrome, setChrome] = useState(PAGE_CHROME_DEFAULT);
  const { sidebarCollapsed, toggleTheme, toggleSidebar } = useShellPreferences();

  useEffect(() => {
    document.body.classList.remove('login-body');
  }, []);

  useEffect(() => {
    if (window.RSSelect && typeof window.RSSelect.refresh === 'function') {
      window.RSSelect.refresh();
    }
  }, [location.pathname, location.search]);

  if (isLoading) {
    return null;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <PageChromeContext.Provider value={setChrome}>
      <div className="ambient-light" aria-hidden="true">
        <span className="ambient-light__blob ambient-light__blob--gold" />
        <span className="ambient-light__blob ambient-light__blob--blue" />
      </div>

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
            <header className="topbar">
              <div className="topbar-main">
                <div className="topbar-side topbar-side-left">
                  {chrome.actions ? <div className="topbar-actions">{chrome.actions}</div> : null}
                  <button className="theme-toggle" type="button" aria-label="Alternar tema" title="Alternar tema" onClick={toggleTheme}>
                    <span className="theme-icon" aria-hidden="true">
                      <svg className="sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2.5" />
                        <path d="M12 19.5V22" />
                        <path d="m4.93 4.93 1.77 1.77" />
                        <path d="m17.3 17.3 1.77 1.77" />
                        <path d="M2 12h2.5" />
                        <path d="M19.5 12H22" />
                        <path d="m4.93 19.07 1.77-1.77" />
                        <path d="m17.3 6.7 1.77-1.77" />
                      </svg>
                      <svg className="moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3a6 6 0 1 0 9 9 9 9 0 1 1-9-9" />
                      </svg>
                    </span>
                    <span className="sr-only">Alternar tema</span>
                  </button>
                </div>

                <div className="topbar-center">
                  <span className="topbar-pill">{chrome.label}</span>
                </div>

                <div className="topbar-side topbar-side-right">
                  <div className="profile topbar-profile-mobile">
                    <div className="avatar">{currentUser.name.slice(0, 1).toUpperCase()}</div>
                    <div className="profile-copy">
                      <strong>{currentUser.name}</strong>
                      <span>{new Intl.DateTimeFormat('pt-BR').format(new Date())}</span>
                    </div>
                  </div>

                  <button className="topbar-icon-link logout-link topbar-logout-mobile" type="button" aria-label="Sair" title="Sair" onClick={sair}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m16 17 5-5-5-5" />
                      <path d="M21 12H9" />
                      <path d="M13 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
                    </svg>
                    <span className="sr-only">Sair</span>
                  </button>
                </div>
              </div>

            </header>

            <main className="main">
              <FlashMessages />
              <Outlet />
            </main>
          </div>
        </div>
      </div>

      <BottomNavigation />
    </PageChromeContext.Provider>
  );
}
