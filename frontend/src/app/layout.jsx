import { createContext, Suspense, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useMatch } from 'react-router-dom';
import { Toaster } from 'sonner';
import {
  Bell,
  BookOpen,
  Briefcase,
  Calendar,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Clock,
  DollarSign,
  Ellipsis,
  FileText,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Timer,
  TrendingUp,
  UserCog,
  Users,
  Video,
  X,
} from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { AppearancePanel } from './components/appearance-panel';
import { useFocusTrap } from './hooks/use-focus-trap';
import { useOnboardingLauncher } from './components/onboarding-launcher';
import { AnimatePresence, MotionPage } from './motion';
import { NAV_ITEMS } from './data';
import { useAppState } from './store';
import { useAppearanceState } from './use-appearance';
import { formatTime, isFinishedTask } from './utils';
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
  configuracoes: Settings,
};

const PageChromeContext = createContext(() => {});
const PAGE_CHROME_DEFAULT = { label: 'Painel', actions: null, primaryAction: null };
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

// primaryAction: { label, to | onClick, tour } — pílula preta da topbar.
// `actions` renderiza à esquerda do sino. Ambos são lidos só no mount/troca de label
// (onClick de primaryAction deve ser estável).
export function PageChrome({ label, actions = null, primaryAction = null }) {
  const setChrome = useContext(PageChromeContext);

  useEffect(() => {
    setChrome({ label, actions, primaryAction });

    return () => {
      setChrome(PAGE_CHROME_DEFAULT);
    };
    // Actions are intentionally treated as route-level chrome and refreshed on mount/unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, primaryAction?.label, primaryAction?.to, setChrome]);

  return null;
}

export function PageSearch({
  value,
  onChange,
  placeholder = 'Buscar',
  label = 'Busca da página',
  inputProps = {},
  className = '',
}) {
  return (
    <div className={`page-search-inline${className ? ` ${className}` : ''}`}>
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

// Legacy tones (gold/muted) fold into the neutral dot. `pill` renders a filled
// pill (priority); default is dot + text (status).
const LEGACY_TONES = { gold: 'subtle', muted: 'subtle' };

export function StatusBadge({ tone = 'subtle', pill = false, children, className = '' }) {
  const resolved = LEGACY_TONES[tone] || tone;
  const nextClassName = `${pill ? 'pill-badge' : 'status-dot'} ${resolved}${className ? ` ${className}` : ''}`;
  return <span className={nextClassName}>{children}</span>;
}

function LoadingScreen() {
  return (
    <main className="loading-screen" aria-live="polite" aria-busy="true">
      <section className="loading-card" role="status">
        <span className="brand-logo brand-logo-full loading-logo" role="img" aria-label="RS Advocacia" />

        <div className="loading-progress" aria-hidden="true">
          <span />
        </div>

        <p className="loading-copy">Carregando sistema</p>
      </section>
    </main>
  );
}

function useVisibleNavItems() {
  const { hasPermission } = useAppState();
  return NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission));
}

const NAV_GROUPS = ['Principal', 'Escritório', 'Administração'];

// Prazos abertos que vencem (ou já venceram) até 7 dias à frente — contador do item "Prazos".
function useWeekDeadlineCount() {
  const { deadlines } = useAppState();
  return deadlines.filter((deadline) => {
    const days = daysUntil(deadline.date);
    return days !== null && days <= 7 && !isFinishedTask(deadline);
  }).length;
}

function SidebarNavLink({ item, collapsed, count = 0 }) {
  // isActive é calculado aqui fora (useMatch) em vez de usar a forma função
  // de className/children do NavLink: quando collapsed envolve este link num
  // <TooltipTrigger asChild>, o Slot do Radix clona o elemento e serializa
  // props em função como string ao mesclar — className virava o texto-fonte
  // da função (bug visível: link do Painel com classe quebrada + tooltip
  // presa). className/children aqui são valores simples, não funções.
  const isActive = Boolean(useMatch({ path: item.to, end: item.to === '/' }));

  const link = (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      aria-label={count ? `${item.label} — ${count} em aberto (vencidos ou até 7 dias)` : item.label}
      data-tour={`nav-${item.key}`}
      className={cn(
        'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[1rem] font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink',
        collapsed && 'mx-auto size-10 justify-center gap-0 rounded-md px-0 py-0',
        isActive && 'bg-accent-soft font-bold text-ink hover:bg-accent-soft hover:text-ink',
      )}
    >
      <NavigationIcon icon={item.key} className={cn('size-[18px] shrink-0', isActive && 'text-[var(--accent)]')} />
      <span
        className={cn(
          'min-w-0 flex-1 truncate transition-[max-width,opacity] duration-200',
          collapsed && 'pointer-events-none max-w-0 flex-none opacity-0',
        )}
      >
        {item.label}
      </span>
      {count > 0 && (
        <span
          className={cn(
            'shrink-0 rounded-pill bg-[var(--danger-soft)] px-1.5 py-0.5 text-[11px] font-bold leading-none text-[var(--danger-ink)] tabular-nums',
            collapsed && 'absolute -right-1 -top-1',
          )}
          aria-hidden="true"
        >
          {count > 99 ? '99+' : count}
        </span>
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
  const weekDeadlines = useWeekDeadlineCount();
  return (
    <nav className="grid gap-4" aria-label="Áreas do sistema">
      {NAV_GROUPS.map((group) => {
        const items = navItems.filter((item) => item.group === group);
        if (!items.length) return null;
        return (
          <div key={group} className="grid gap-1" role="group" aria-label={group}>
            <span
              className={cn(
                'px-3 pb-1 text-[11px] font-bold uppercase tracking-[.08em] text-subtle',
                collapsed && 'sr-only',
              )}
            >
              {group}
            </span>
            {items.map((item) => (
              <SidebarNavLink
                key={item.key}
                item={item}
                collapsed={collapsed}
                count={item.key === 'prazos' ? weekDeadlines : 0}
              />
            ))}
          </div>
        );
      })}
    </nav>
  );
}

const BOTTOM_NAV_FIXED = ['painel', 'clientes', 'agenda', 'prazos'];
const MORE_TILE_CLASS =
  'grid min-h-[72px] place-items-center content-center gap-1.5 rounded-md bg-surface-2 px-2 py-2.5 text-center text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink';

// Folha "Mais" (<=1200px): demais áreas do sistema agrupadas + ações da conta. Fecha com Esc,
// clique no fundo ou ao navegar; prende o foco e devolve ao botão "Mais" ao fechar.
function MoreSheet({ open, onClose, items, onOpenAppearance, onStartTour }) {
  const { currentUser, currentRole, sair } = useAppState();
  const panelRef = useRef(null);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.querySelector('a, button')?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function act(fn) {
    onClose();
    fn?.();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[var(--backdrop)] min-[1201px]:hidden" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Mais áreas do sistema"
        className="flex max-h-[85vh] w-full max-w-[640px] flex-col gap-3 overflow-y-auto rounded-t-lg bg-card p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-pop"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <Avatar name={currentUser?.name} seed={currentUser?.id} size={40} />
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-[1rem] font-bold text-ink">{currentUser?.name}</strong>
            <span className="block truncate text-meta-sm text-muted-foreground">{currentRole?.name || 'Usuário'}</span>
          </div>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full bg-surface-2 text-ink-2 hover:bg-surface-3"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X className="size-[18px]" aria-hidden="true" />
          </button>
        </div>

        {NAV_GROUPS.map((group) => {
          const groupItems = items.filter((item) => item.group === group);
          if (!groupItems.length) return null;
          return (
            <section key={group} aria-label={group} className="grid gap-2">
              <span className="px-1 text-label uppercase text-subtle">{group}</span>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {groupItems.map((item) => (
                  <NavLink
                    key={item.key}
                    to={item.to}
                    aria-label={item.label}
                    className={({ isActive }) =>
                      cn(MORE_TILE_CLASS, isActive && 'bg-accent-soft font-bold text-ink hover:bg-accent-soft')
                    }
                    onClick={onClose}
                  >
                    <NavigationIcon icon={item.key} className="size-5" />
                    <span className="max-w-full truncate text-[.75rem] font-semibold">{item.mobileLabel}</span>
                  </NavLink>
                ))}
              </div>
            </section>
          );
        })}

        <section aria-label="Conta" className="grid gap-1 border-t border-line pt-2">
          {onOpenAppearance ? (
            <button type="button" className={cn(PROFILE_ITEM_CLASS, 'min-h-11')} onClick={() => act(onOpenAppearance)}>
              <Sparkles className="size-4" strokeWidth={1.8} />
              Aparência
            </button>
          ) : null}
          <Link to="/manual" className={cn(PROFILE_ITEM_CLASS, 'min-h-11')} onClick={onClose}>
            <BookOpen className="size-4" strokeWidth={1.8} />
            Manual do sistema
          </Link>
          {onStartTour ? (
            <button type="button" className={cn(PROFILE_ITEM_CLASS, 'min-h-11')} data-tour="rever-tour" onClick={() => act(onStartTour)}>
              <CircleHelp className="size-4" strokeWidth={1.8} />
              Rever tour
            </button>
          ) : null}
          <button
            type="button"
            className="flex min-h-11 items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm font-semibold text-[var(--danger-ink)] transition-colors hover:bg-[var(--danger-soft)]"
            onClick={() => act(sair)}
          >
            <LogOut className="size-4" strokeWidth={1.8} />
            Sair
          </button>
        </section>
      </div>
    </div>
  );
}

// Barra inferior (<=1200px): 4 áreas fixas + "Mais" (uma única linha em qualquer largura).
function BottomNavigation({ onOpenAppearance, onStartTour }) {
  const navItems = useVisibleNavItems();
  const location = useLocation();
  // Guarda a rota em que a folha foi aberta: mudar de rota (inclusive voltar do navegador) fecha sozinha.
  const [moreOpenPath, setMoreOpenPath] = useState(null);
  const moreOpen = moreOpenPath === location.pathname;
  // Trocou de rota (inclusive voltar/avançar do navegador): descarta o estado para não reabrir ao retornar.
  if (moreOpenPath !== null && !moreOpen) {
    setMoreOpenPath(null);
  }

  // Ao passar do breakpoint da barra inferior a folha fica oculta (CSS): encerra o estado e libera o scroll.
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1201px)');
    const onChange = (event) => {
      if (event.matches) setMoreOpenPath(null);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  const fixedItems = BOTTOM_NAV_FIXED.map((key) => navItems.find((item) => item.key === key)).filter(Boolean);
  const moreItems = navItems.filter((item) => !BOTTOM_NAV_FIXED.includes(item.key));
  const moreActive = moreItems.some((item) => (item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)));
  const closeMore = useCallback(() => setMoreOpenPath(null), []);

  // Enquanto aberta, o fundo não rola.
  useEffect(() => {
    if (!moreOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [moreOpen]);

  const cellClass = 'group grid min-h-[52px] min-w-0 flex-1 place-items-center content-center gap-0.5 rounded-md px-1 py-1.5 text-ink-2 transition-colors hover:bg-surface-2';
  const activeClass = 'bg-accent-soft font-bold text-ink hover:bg-accent-soft';

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-50 px-[max(10px,env(safe-area-inset-left))] pb-[calc(10px+env(safe-area-inset-bottom))] min-[1201px]:hidden"
      >
        <nav className="mx-auto flex w-full max-w-[640px] items-stretch gap-1 rounded-[24px] bg-surface p-1.5 shadow-pop" aria-label="Navegação principal">
          {fixedItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.to === '/'}
              aria-label={item.label}
              className={({ isActive }) => cn(cellClass, isActive && activeClass)}
            >
              <NavigationIcon icon={item.key} className="size-[20px] group-[.active]:text-[var(--accent)]" />
              <span className="max-w-full truncate text-[.7rem] font-bold">{item.mobileLabel}</span>
            </NavLink>
          ))}
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-label="Mais áreas do sistema"
            className={cn(cellClass, moreActive && activeClass)}
            onClick={() => setMoreOpenPath(location.pathname)}
          >
            <Ellipsis className={cn('size-[20px]', moreActive && 'text-[var(--accent)]')} aria-hidden="true" />
            <span className="max-w-full truncate text-[.7rem] font-bold">Mais</span>
          </button>
        </nav>
      </div>
      <MoreSheet open={moreOpen} onClose={closeMore} items={moreItems} onOpenAppearance={onOpenAppearance} onStartTour={onStartTour} />
    </>
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

function useDismiss(open, setOpen, ref) {
  useEffect(() => {
    if (!open) return undefined;
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
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
  }, [open, ref, setOpen]);
}

function NotificationList({ notifications }) {
  const { notificacoes, totalNaoLidas, marcarLida, marcarTodasLidas } = notifications;
  return (
    <>
      <div className="flex items-center justify-between border-b border-line px-3.5 py-3 text-sm">
        <strong className="text-ink">Notificações</strong>
        {totalNaoLidas > 0 && (
          <button
            type="button"
            className="text-xs font-semibold text-ink underline-offset-2 hover:underline"
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
              className="flex items-start gap-2.5 border-b border-line px-3.5 py-2.5 last:border-0 hover:bg-surface-2"
            >
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-sm bg-surface-2 text-muted-foreground">
                <NotifTypeIcon tipo={n.tipo} />
              </span>
              <div className="min-w-0 flex-1">
                <strong className="block text-sm font-semibold text-ink">{n.titulo}</strong>
                {n.mensagem && <p className="mt-0.5 text-xs text-muted-foreground">{n.mensagem}</p>}
                {n.criada_em && (
                  <time className="mt-1 block text-[.7rem] text-muted-foreground" dateTime={n.criada_em}>
                    {formatRelTime(n.criada_em)}
                  </time>
                )}
              </div>
              <button
                type="button"
                className="shrink-0 text-muted-foreground hover:text-ink"
                aria-label="Marcar como lida"
                onClick={() => marcarLida(n.id)}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function NotificationBell({ notifications }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { totalNaoLidas } = notifications;
  useDismiss(open, setOpen, ref);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="relative grid size-11 place-items-center rounded-full bg-surface-2 max-[1024px]:size-[42px] text-ink transition-colors hover:bg-surface-3"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={totalNaoLidas ? `Notificações — ${totalNaoLidas} não lidas` : 'Notificações'}
        onClick={() => setOpen((p) => !p)}
      >
        <Bell className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
        {totalNaoLidas > 0 && (
          <span
            className="absolute right-3 top-3 size-2 rounded-full bg-[var(--danger)] ring-2 ring-[var(--surface-2)]"
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-[320px] max-w-[calc(100vw-32px)] rounded-lg bg-card shadow-pop"
          role="dialog"
          aria-label="Notificações"
        >
          <NotificationList notifications={notifications} />
        </div>
      )}
    </div>
  );
}

// Menu de atalhos ao lado da ação primária: primaryAction.menu = [{ to, label, tour, Icon }].
function PrimaryMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(open, setOpen, ref);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="grid size-11 place-items-center rounded-full bg-surface-2 max-[1024px]:size-[42px] text-ink transition-colors hover:bg-surface-3"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Mais atalhos"
        onClick={() => setOpen((p) => !p)}
      >
        <ChevronDown className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 flex w-[260px] flex-col gap-0.5 rounded-lg bg-card p-1.5 shadow-pop"
        >
          {items.map(({ to, label, tour, Icon }) => (
            <Link
              key={to}
              to={to}
              role="menuitem"
              data-tour={tour}
              className={PROFILE_ITEM_CLASS}
              onClick={() => setOpen(false)}
            >
              {Icon ? <Icon className="size-4 shrink-0" strokeWidth={1.8} /> : null}
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Topbar({ chrome, notifications }) {
  const { label, actions, primaryAction } = chrome;
  const primaryContent = primaryAction && (
    <>
      <Plus className="size-4" aria-hidden="true" />
      <span className="max-sm:sr-only">{primaryAction.label}</span>
    </>
  );

  return (
    <header className="app-topbar sticky top-[var(--shell-pad)] z-30 flex h-[var(--topbar-h)] items-center justify-between gap-3 rounded-lg bg-surface pl-5 pr-2 max-sm:pl-4">
      <nav aria-label="Trilha de navegação" className="min-w-0">
        <ol className="m-0 flex min-w-0 list-none items-center gap-2 p-0 text-sm font-semibold text-muted-foreground">
          <li className="max-sm:hidden">RS Advocacia</li>
          <li aria-hidden="true" className="max-sm:hidden">
            <ChevronRight className="size-3.5" />
          </li>
          <li className="min-w-0 truncate text-ink" aria-current="page">{label}</li>
        </ol>
      </nav>

      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <NotificationBell notifications={notifications} />
        {primaryAction && (
          primaryAction.to ? (
            <Button asChild className="max-sm:px-3.5">
              <Link to={primaryAction.to} data-tour={primaryAction.tour}>{primaryContent}</Link>
            </Button>
          ) : (
            <Button type="button" className="max-sm:px-3.5" data-tour={primaryAction.tour} onClick={primaryAction.onClick}>
              {primaryContent}
            </Button>
          )
        )}
        {primaryAction?.menu?.length ? <PrimaryMenu items={primaryAction.menu} /> : null}
      </div>
    </header>
  );
}

const PROFILE_ITEM_CLASS =
  'flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink';

function ProfileMenu({ onOpenAppearance, onStartTour, collapsed, notifications }) {
  const { currentUser, currentRole, sair } = useAppState();
  const { totalNaoLidas } = notifications;
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  useDismiss(open, setOpen, menuRef);

  function handleAction(fn) {
    setOpen(false);
    fn?.();
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className={cn(
          'relative flex w-full min-w-0 items-center gap-2.5 rounded-md bg-surface-2 p-2 text-left transition-colors hover:bg-surface-3',
          collapsed && 'mx-auto size-10 justify-center gap-0 p-0',
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Menu do usuário${totalNaoLidas ? ` — ${totalNaoLidas} notificações` : ''}`}
        onClick={() => setOpen((p) => !p)}
      >
        <Avatar name={currentUser.name} seed={currentUser.id} size={collapsed ? 40 : 38} />
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
          <strong className="block truncate text-sm font-bold text-ink">{currentUser.name}</strong>
          <span className="block truncate text-xs font-medium text-muted-foreground">{currentRole?.name || 'Usuário'}</span>
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
          className="absolute bottom-full left-0 z-50 mb-2 w-[300px] rounded-lg bg-card shadow-pop"
          role="dialog"
          aria-label="Menu do usuário"
        >
          <NotificationList notifications={notifications} />

          <Separator />

          <nav className="flex flex-col gap-0.5 p-1.5" aria-label="Ações do usuário">
            {onOpenAppearance && (
              <button type="button" className={PROFILE_ITEM_CLASS} onClick={() => handleAction(onOpenAppearance)}>
                <Sparkles className="size-4" strokeWidth={1.8} />
                Aparência
              </button>
            )}
            <Link to="/manual" className={PROFILE_ITEM_CLASS} onClick={() => setOpen(false)}>
              <BookOpen className="size-4" strokeWidth={1.8} />
              Manual do sistema
            </Link>
            {onStartTour && (
              <button
                type="button"
                className={PROFILE_ITEM_CLASS}
                data-tour="rever-tour"
                onClick={() => handleAction(onStartTour)}
              >
                <CircleHelp className="size-4" strokeWidth={1.8} />
                Rever tour
              </button>
            )}
            <button
              type="button"
              className="flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm font-semibold text-[var(--danger-ink)] transition-colors hover:bg-[var(--danger-soft)]"
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

// Só monta depois da checagem de auth: useNotifications faz polling na API.
function ShellFrame({ chrome, appearance, sidebarCollapsed, toggleSidebar, startTour, hasTour, location }) {
  const notifications = useNotifications();

  return (
    <>
      <a href="#main-content" className="skip-link">Ir para o conteúdo</a>
      <div
        className="shell min-[1201px]:grid min-[1201px]:items-start"
        style={{ gridTemplateColumns: `${sidebarCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar)'} minmax(0, 1fr)` }}
      >
        <aside
          id="app-sidebar"
          aria-label="Navegação principal"
          className="group sticky top-[var(--shell-pad)] z-40 hidden h-[calc(100vh-var(--shell-pad)*2)] flex-col rounded-[28px] bg-surface min-[1201px]:flex"
        >
          <Button
            variant="outline"
            size="icon"
            className="absolute right-[-22px] top-1/2 z-10 size-10 -translate-y-1/2 rounded-full bg-surface opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
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
              'flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden pt-5',
              sidebarCollapsed ? 'px-3' : 'px-4',
            )}
          >
            <Link
              className={cn('flex items-center gap-3 p-1', sidebarCollapsed && 'justify-center gap-0 p-0')}
              to="/"
              aria-label="Ir para a área inicial"
              title="Início"
            >
              <span
                className={cn('brand-logo shrink-0 text-ink', sidebarCollapsed ? 'brand-logo-mono' : 'brand-logo-stack')}
                style={{ '--brand-w': sidebarCollapsed ? '36px' : '100%' }}
                role="img"
                aria-label="RS Advocacia empresarial e trabalhista especializada"
              />
            </Link>

            <SidebarNavigation collapsed={sidebarCollapsed} />
          </div>

          <div className="shrink-0 p-3">
            <ProfileMenu
              onOpenAppearance={() => appearance.setOpen(true)}
              onStartTour={hasTour ? startTour : undefined}
              collapsed={sidebarCollapsed}
              notifications={notifications}
            />
          </div>
        </aside>

        <div className="page">
          <Topbar chrome={chrome} notifications={notifications} />
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

      <AppearancePanel
        appearance={appearance.appearance}
        setOption={appearance.setOption}
        reset={appearance.reset}
        open={appearance.open}
        onClose={() => appearance.setOpen(false)}
      />

      <BottomNavigation
        onOpenAppearance={() => appearance.setOpen(true)}
        onStartTour={hasTour ? startTour : undefined}
      />
      <Toaster
        theme={appearance.appearance.theme}
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{
          style: {
            background: 'var(--surface)',
            border: '1px solid var(--line-strong)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-pop)',
            color: 'var(--ink)',
            fontFamily: 'var(--sans)',
          },
        }}
      />
    </>
  );
}

export function ProtectedLayout() {
  const { addFlash, currentUser, deadlines, events, isLoading } = useAppState();
  const location = useLocation();
  const [chrome, setChrome] = useState(PAGE_CHROME_DEFAULT);
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
        <ShellFrame
          chrome={chrome}
          appearance={appearance}
          sidebarCollapsed={sidebarCollapsed}
          toggleSidebar={toggleSidebar}
          startTour={startTour}
          hasTour={hasTour}
          location={location}
        />
      </TooltipProvider>
    </PageChromeContext.Provider>
  );
}
