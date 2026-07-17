import { createContext, Suspense, useContext, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import {
  Bell,
  Briefcase,
  Calendar,
  CalendarCheck,
  ChevronUp,
  CircleHelp,
  Clock,
  DollarSign,
  FileText,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Sparkles,
  Timer,
  TrendingUp,
  UserCog,
  Users,
  Video,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { AppearancePanel, AppearanceTrigger } from './components/appearance-panel';
import { useOnboardingLauncher } from './components/onboarding-launcher';
import { AnimatePresence, MotionPage } from './motion';
import { NAV_ITEMS } from './data';
import { useAppState } from './store';
import { useAppearanceState } from './use-appearance';
import { formatTime, normalizeText } from './utils';
import { useNotifications } from './hooks/use-notifications';

const NAV_ICONS = {
  painel: LayoutDashboard,
  clientes: Users,
  processos: Briefcase,
  agenda: Calendar,
  prazos: CalendarCheck,
  peticoes: FileText,
  reunioes: Video,
  produtividade: Timer,
  prospeccao: TrendingUp,
  financeiro: DollarSign,
  auditoria: ShieldCheck,
  usuarios: UserCog,
};

const PageChromeContext = createContext(() => {});
const PAGE_CHROME_DEFAULT = { label: 'Painel', actions: null };
const DAY_IN_MS = 24 * 60 * 60 * 1000;

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

function NavigationIcon({ icon, className }) {
  const Icon = NAV_ICONS[icon] || UserCog;
  return <Icon className={className} strokeWidth={1.7} />;
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

function SidebarNavLink({ item, collapsed }) {
  const link = (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      aria-label={item.label}
      data-tour={`nav-${item.key}`}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground',
          collapsed && 'justify-center px-0',
          isActive && 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'absolute left-1 top-1/2 h-0 w-[3px] -translate-y-1/2 rounded-full bg-primary opacity-0 transition-[height,opacity] duration-200',
              isActive && 'h-[56%] opacity-100',
            )}
            aria-hidden="true"
          />
          <NavigationIcon
            icon={item.key}
            className={cn(
              'size-5 shrink-0 transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
            )}
          />
          <span
            className={cn(
              'truncate transition-[max-width,opacity] duration-200',
              collapsed && 'pointer-events-none max-w-0 opacity-0',
            )}
          >
            {item.label}
          </span>
        </>
      )}
    </NavLink>
  );

  if (!collapsed) {
    return link;
  }

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

function SidebarNavigation({ collapsed }) {
  const navItems = useVisibleNavItems();
  return (
    <nav className="grid gap-1.5" aria-label="Áreas do sistema">
      {navItems.map((item) => (
        <SidebarNavLink key={item.key} item={item} collapsed={collapsed} />
      ))}
    </nav>
  );
}

function BottomNavigation() {
  const navItems = useVisibleNavItems();
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 px-[max(14px,env(safe-area-inset-left))] pb-[calc(12px+env(safe-area-inset-bottom))] min-[1201px]:hidden"
      aria-hidden="false"
    >
      <nav
        className="mx-auto w-full max-w-[840px] rounded-[28px] border border-border bg-card/95 p-2.5 shadow-lg backdrop-blur-xl"
        aria-label="Navegação principal"
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(58px,1fr))] gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.to === '/'}
              aria-label={item.label}
              className={({ isActive }) =>
                cn(
                  'grid min-h-16 place-items-center gap-1.5 rounded-2xl border border-transparent px-2 py-2.5 text-muted-foreground transition-colors',
                  isActive && 'border-primary/30 bg-primary text-primary-foreground',
                )
              }
            >
              <NavigationIcon icon={item.key} className="size-[22px]" />
              <span className="max-w-full truncate text-[.68rem] font-bold tracking-wide">
                {item.mobileLabel}
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
  // Colapsada por padrão (rail mínimo) — usuário expande explicitamente se quiser
  // os rótulos visíveis; a preferência dele é lembrada depois disso.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('rs-advocacia-sidebar-collapsed') !== 'false');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
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

const NOTIF_TYPE_ICONS = { prazo: Clock, evento: Calendar, reuniao: Video };

function NotifTypeIcon({ tipo }) {
  const Icon = NOTIF_TYPE_ICONS[tipo] || Bell;
  return <Icon className="size-3.5" strokeWidth={1.8} aria-hidden="true" />;
}

function ProfileMenu({ onOpenAppearance, onStartTour, collapsed }) {
  const { currentUser, currentRole, sair } = useAppState();
  const { notificacoes, totalNaoLidas, marcarLida, marcarTodasLidas } = useNotifications();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function handleAction(fn) {
    setOpen(false);
    fn?.();
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className={cn(
          'relative flex w-full min-w-0 items-center gap-2.5 rounded-2xl border border-border bg-card/60 px-2.5 py-2 text-left transition-colors hover:bg-accent/10',
          collapsed && 'justify-center px-0',
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Menu do usuário${totalNaoLidas ? ` — ${totalNaoLidas} notificações` : ''}`}
        onClick={() => setOpen((p) => !p)}
      >
        <div
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary font-bold text-primary-foreground"
          aria-hidden="true"
        >
          {currentUser.name.slice(0, 1).toUpperCase()}
        </div>
        {totalNaoLidas > 0 && (
          <Badge
            variant="destructive"
            className={cn('shrink-0', collapsed && 'absolute -right-1 -top-1 px-1.5')}
            aria-hidden="true"
          >
            {totalNaoLidas > 9 ? '9+' : totalNaoLidas}
          </Badge>
        )}
        <div
          className={cn(
            'min-w-0 flex-1 overflow-hidden transition-[max-width,opacity] duration-200',
            collapsed && 'max-w-0 flex-none opacity-0',
          )}
        >
          <strong className="block truncate text-sm font-semibold text-foreground">{currentUser.name}</strong>
          <span className="block truncate text-xs text-muted-foreground">{currentRole?.name || 'Usuário'}</span>
        </div>
        <ChevronUp
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground transition-transform',
            !open && 'rotate-180',
            collapsed && 'hidden',
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 w-[300px] rounded-2xl border border-border bg-card shadow-xl"
          role="dialog"
          aria-label="Menu do usuário"
        >
          <div className="flex items-center justify-between border-b border-border px-3.5 py-3 text-sm">
            <strong className="text-foreground">Notificações</strong>
            {totalNaoLidas > 0 && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={marcarTodasLidas}
              >
                Marcar todas lidas
              </button>
            )}
          </div>

          {notificacoes.length === 0 ? (
            <div className="px-3.5 py-5 text-center text-sm text-muted-foreground">
              Sem notificações pendentes.
            </div>
          ) : (
            <ul className="max-h-[280px] overflow-y-auto py-1" role="list">
              {notificacoes.map((n) => (
                <li
                  key={n.id}
                  className="flex items-start gap-2.5 border-b border-border/60 px-3.5 py-2.5 last:border-0 hover:bg-accent/5"
                >
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-muted/40 text-muted-foreground">
                    <NotifTypeIcon tipo={n.tipo} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block text-sm font-semibold text-foreground">{n.titulo}</strong>
                    {n.mensagem && <p className="mt-0.5 text-xs text-muted-foreground">{n.mensagem}</p>}
                    {n.criada_em && (
                      <time className="mt-1 block text-[.7rem] text-muted-foreground" dateTime={n.criada_em}>
                        {formatRelTime(n.criada_em)}
                      </time>
                    )}
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label="Marcar como lida"
                    onClick={() => marcarLida(n.id)}
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Separator />

          <nav className="flex flex-col gap-0.5 p-1.5" aria-label="Ações do usuário">
            {onOpenAppearance && (
              <button
                type="button"
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
                onClick={() => handleAction(onOpenAppearance)}
              >
                <Sparkles className="size-4" strokeWidth={1.8} />
                Aparência
              </button>
            )}
            {onStartTour && (
              <button
                type="button"
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
                data-tour="rever-tour"
                onClick={() => handleAction(onStartTour)}
              >
                <CircleHelp className="size-4" strokeWidth={1.8} />
                Rever tour
              </button>
            )}
            <button
              type="button"
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
              onClick={() => handleAction(sair)}
            >
              <LogOut className="size-4" strokeWidth={1.8} />
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
      <TooltipProvider delayDuration={200}>
      <a href="#main-content" className="skip-link">Ir para o conteúdo</a>
      <div className="shell">
        <aside
          id="app-sidebar"
          aria-label="Navegação principal"
          className={cn(
            'group fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-transparent transition-[width] duration-300 ease-out min-[1201px]:flex',
          )}
          style={{ width: sidebarCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar)' }}
        >
          <Button
            variant="outline"
            size="icon"
            className="absolute right-[-21px] top-1/2 z-10 size-10 -translate-y-1/2 rounded-full opacity-0 shadow-lg backdrop-blur transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            aria-controls="app-sidebar"
            aria-expanded={sidebarCollapsed ? 'false' : 'true'}
            aria-label={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            title={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            onClick={toggleSidebar}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>

          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden pt-4.5',
              sidebarCollapsed ? 'px-2.5' : 'px-4.5',
            )}
          >
            <Link
              className={cn(
                'flex items-center gap-3 rounded-[20px] p-2',
                sidebarCollapsed && 'justify-center',
              )}
              to="/"
              aria-label="Ir para a área inicial"
              title="Início"
            >
              <div
                className="grid size-11 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"
                aria-hidden="true"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v18" />
                  <path d="m19 8 3 8a5 5 0 0 1-6 0z" />
                  <path d="m5 8 3 8a5 5 0 0 1-6 0z" />
                  <path d="M3 7h18" />
                  <path d="M7 21h10" />
                </svg>
              </div>
              <div
                className={cn(
                  'min-w-0 max-w-[180px] overflow-hidden transition-[max-width,opacity] duration-200',
                  sidebarCollapsed && 'pointer-events-none max-w-0 opacity-0',
                )}
              >
                <strong className="block truncate font-serif text-2xl font-normal text-foreground">
                  RS Advocacia
                </strong>
              </div>
            </Link>

            <SidebarNavigation collapsed={sidebarCollapsed} />
          </div>

          <div className="shrink-0 border-t border-border p-3">
            <ProfileMenu
              onOpenAppearance={() => appearance.setOpen(true)}
              onStartTour={hasTour ? startTour : undefined}
              collapsed={sidebarCollapsed}
            />
          </div>
        </aside>

        <div
          className={cn(
            'page transition-[margin-left] duration-300 ease-out',
            sidebarCollapsed ? 'min-[1201px]:ml-[var(--sidebar-collapsed)]' : 'min-[1201px]:ml-[var(--sidebar)]',
          )}
        >
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
      </TooltipProvider>
    </PageChromeContext.Provider>
  );
}
