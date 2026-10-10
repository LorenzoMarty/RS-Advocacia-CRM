import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Briefcase,
  CalendarDays,
  ChevronRight,
  Coins,
  FileClock,
  FileText,
  Plus,
  Users,
} from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

import { PROCESS_AREA_OPTIONS } from "../data";
import { PageChrome, StatusBadge } from "../layout";
import { motion, fadeUp } from "../motion";

const MotionDiv = motion.div;
import { useAppState } from "../store";
import {
  formatDate,
  formatRelativeDue,
  formatTime,
  getStatusTone,
  isFinishedTask,
  isSameDay,
  normalizeText,
  startOfDay,
} from "../utils";
import { EmptyState } from "./common";

const SHORTCUTS = [
  { to: "/agenda/novo", label: "Novo compromisso", tour: "shortcut-novo-compromisso", Icon: Plus },
  { to: "/clientes/novo", label: "Novo cliente", tour: "shortcut-novo-cliente", Icon: Users },
  { to: "/processos/novo", label: "Novo processo", tour: "shortcut-novo-processo", Icon: Briefcase },
  { to: "/prazos/novo", label: "Novo prazo", tour: "shortcut-novo-prazo", Icon: FileClock },
  { to: "/peticoes-contestacoes", label: "Ver petições e contestações", tour: "shortcut-peticoes", Icon: FileText },
];

const PRIMARY_ACTION = { label: "Novo compromisso", to: "/agenda/novo", tour: "page-primary-action", menu: SHORTCUTS };

const RANGE_OPTIONS = [7, 15, 30].map((days) => ({ value: days, label: `${days} dias` }));
const PRIORITY_TABS = [
  { value: "todos", label: "Todos" },
  { value: "alta", label: "Alta" },
  { value: "semana", label: "Esta semana" },
];

// Mesma ordem de PROCESS_AREA_OPTIONS (Cível, Trabalhista, Empresarial, Tributário) -> --chart-2..5.
const AREA_COLORS = ["var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const WEEKDAY_LETTERS = ["S", "T", "Q", "Q", "S", "S", "D"];
const ROW_GRID = "grid-cols-[minmax(160px,2.2fr)_minmax(90px,1.3fr)_84px_76px]";
const CLOSED_PROCESS = ["arquiv", "conclu"];

function greeting(name) {
  const hour = new Date().getHours();
  const firstName = name?.split(" ")[0] || "";
  const period = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  return firstName ? `${period}, ${firstName}.` : `${period}.`;
}

function weekDays(today) {
  const start = new Date(today);
  const isoDay = start.getDay() || 7; // segunda=1 ... domingo=7
  start.setDate(start.getDate() - isoDay + 1);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function formatBRL(value) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function KpiCard({ title, icon, dark = false, children }) {
  const Icon = icon;
  return (
    <div
      className={cn(
        "flex min-h-[124px] flex-col gap-2.5 rounded-lg p-[var(--pad-card)] sm:min-h-[148px] sm:gap-3.5",
        dark ? "bg-accent-soft-2 text-ink" : "bg-card text-ink",
      )}
    >
      <div className="flex items-start justify-between">
        <span className={cn("text-[1rem] font-bold", !dark && "text-ink-2")}>{title}</span>
        <span
          className={cn(
            "grid size-9 place-items-center rounded-full",
            dark ? "bg-surface text-[var(--accent)]" : "bg-surface-2 text-ink",
          )}
        >
          <Icon className="size-4" strokeWidth={1.9} aria-hidden="true" />
        </span>
      </div>
      {children}
    </div>
  );
}

function KpiNote({ children }) {
  return <span className="text-meta font-semibold text-muted-foreground">{children}</span>;
}

function WeekLoad({ days, counts, today }) {
  const max = Math.max(1, ...counts);
  return (
    <div className="grid h-[120px] grid-cols-7 items-end gap-2" role="img" aria-label={`Carga da semana: ${counts.join(", ")} itens por dia, de segunda a domingo`}>
      {days.map((day, index) => {
        const isToday = isSameDay(day, today);
        const isPast = !isToday && startOfDay(day) < startOfDay(today);
        return (
          <div key={day.toISOString()} className="flex h-full flex-col items-center justify-end gap-1.5">
            <span className="text-[.79rem] font-bold tabular-nums text-muted-foreground">{counts[index]}</span>
            <div
              className={cn("w-full rounded-[10px] bg-surface-3", isToday && "bg-[var(--accent)]", isPast && "bg-line")}
              style={{ height: `${10 + (counts[index] / max) * 62}%` }}
            />
            <span className={cn("text-[.86rem] font-bold", isToday ? "text-ink" : "text-subtle")}>{WEEKDAY_LETTERS[index]}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardPage() {
  const { clients, currentUser, deadlines, events, processes, lancamentos, hasPermission } = useAppState();
  const [range, setRange] = useState(7);
  const [priorityTab, setPriorityTab] = useState("todos");
  const today = new Date();
  const todayStart = startOfDay(today);

  const clientName = (id) => clients.find((client) => client.id === id)?.name || "";
  const processOf = (id) => processes.find((process) => process.id === id);
  const daysFromToday = (value) => Math.round((startOfDay(value) - todayStart) / 86400000);

  const pendingDeadlines = deadlines
    .filter((deadline) => !isFinishedTask(deadline))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const overdueDeadlines = pendingDeadlines.filter((deadline) => startOfDay(deadline.date) < todayStart);
  const dueTodayDeadlines = pendingDeadlines.filter((deadline) => isSameDay(deadline.date, today));
  const nextDeadline = pendingDeadlines[0] || null;

  const eventsToday = events
    .filter((event) => isSameDay(event.start, today))
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  const focusParts = [];
  if (overdueDeadlines.length) {
    focusParts.push(
      `${overdueDeadlines.length} prazo${overdueDeadlines.length > 1 ? "s" : ""} atrasado${overdueDeadlines.length > 1 ? "s" : ""}`,
    );
  }
  if (dueTodayDeadlines.length) {
    focusParts.push(`${dueTodayDeadlines.length} vence${dueTodayDeadlines.length > 1 ? "m" : ""} hoje`);
  }
  if (eventsToday.length) {
    focusParts.push(`${eventsToday.length} compromisso${eventsToday.length > 1 ? "s" : ""} hoje`);
  }

  // KPIs do período selecionado
  const rangeDeadlines = pendingDeadlines.filter((deadline) => {
    const days = daysFromToday(deadline.date);
    return days >= 0 && days <= range;
  });
  const rangeHigh = rangeDeadlines.filter((deadline) => normalizeText(deadline.priority).includes("alta")).length;
  const rangeEvents = events.filter((event) => {
    const days = daysFromToday(event.start);
    return days >= 0 && days <= range;
  });
  const hearings = rangeEvents.filter((event) => normalizeText(event.type).includes("audien")).length;
  const meetings = rangeEvents.filter((event) => normalizeText(event.type).includes("reun")).length;

  const activeProcesses = processes.filter((process) => {
    const status = normalizeText(process.status);
    return !CLOSED_PROCESS.some((closed) => status.includes(closed));
  });
  const areaBar = PROCESS_AREA_OPTIONS.map((area, index) => ({
    label: area,
    color: AREA_COLORS[index],
    n: activeProcesses.filter((process) => normalizeText(process.area) === normalizeText(area)).length,
  })).filter((area) => area.n > 0);

  const canSeeFinance = hasPermission("financeiro.view_lancamento");
  const receivables = canSeeFinance
    ? lancamentos.filter((item) => item.type === "receita" && item.status === "Pendente")
    : [];
  const receivableTotal = receivables.reduce((sum, item) => sum + item.value, 0);

  // Tabela de prazos fatais
  const tableRows = pendingDeadlines
    .filter((deadline) => {
      if (priorityTab === "alta") return normalizeText(deadline.priority).includes("alta");
      if (priorityTab === "semana") return daysFromToday(deadline.date) <= 7;
      return true;
    })
    .slice(0, 8);

  // "Hoje": compromissos de hoje e de amanhã
  const agenda = events
    .filter((event) => {
      const days = daysFromToday(event.start);
      return days === 0 || days === 1;
    })
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .slice(0, 5);

  const days = weekDays(today);
  const weekCounts = days.map(
    (day) =>
      deadlines.filter((deadline) => !deadline.completed && isSameDay(deadline.date, day)).length +
      events.filter((event) => isSameDay(event.start, day)).length,
  );

  const nextDue = nextDeadline ? formatRelativeDue(nextDeadline.date, today) : null;
  const nextProcess = nextDeadline ? processOf(nextDeadline.processId) : null;

  return (
    <div className="dashboard-page flex flex-col gap-[var(--gap-grid)]">
      <PageChrome label="Painel" primaryAction={PRIMARY_ACTION} />

      <PageHeader compact title={greeting(currentUser?.name)} subtitle={focusParts.length ? focusParts.join(" · ") : "Nada urgente agora."}>
        <Segmented tone="bg" label="Período" options={RANGE_OPTIONS} value={range} onChange={setRange} />
      </PageHeader>

      <MotionDiv className="flex flex-col gap-[var(--gap-grid)]" variants={fadeUp} initial="hidden" animate="visible">
        <div className={cn("grid grid-cols-2 gap-[var(--gap-grid)]", canSeeFinance ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
          <KpiCard dark title={`Prazos em ${range} dias`} icon={ArrowUpRight}>
            <strong className="text-[2.1rem] font-extrabold leading-none tracking-[-0.03em] tabular-nums sm:text-kpi">{rangeDeadlines.length}</strong>
            <KpiNote>{rangeHigh} com prioridade alta</KpiNote>
          </KpiCard>

          <KpiCard title="Processos ativos" icon={Briefcase}>
            <strong className="text-[2.1rem] font-extrabold leading-none tracking-[-0.03em] tabular-nums sm:text-kpi">{activeProcesses.length}</strong>
            {areaBar.length ? (
              <>
                <div className="flex h-2 gap-1 overflow-hidden rounded-pill" aria-hidden="true">
                  {areaBar.map((area) => (
                    <span key={area.label} title={area.label} style={{ flex: area.n, background: area.color }} />
                  ))}
                </div>
                <ul className="m-0 -mt-1.5 flex list-none flex-wrap gap-x-3 gap-y-1 p-0">
                  {areaBar.map((area) => (
                    <li key={area.label} className="flex items-center gap-1.5 text-[.86rem] font-semibold text-muted-foreground">
                      <span className="size-[7px] rounded-full" style={{ background: area.color }} aria-hidden="true" />
                      {area.label} {area.n}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </KpiCard>

          <KpiCard title="Compromissos" icon={CalendarDays}>
            <strong className="text-[2.1rem] font-extrabold leading-none tracking-[-0.03em] tabular-nums sm:text-kpi">{rangeEvents.length}</strong>
            <KpiNote>
              {hearings} audiências · {meetings} reuniões
            </KpiNote>
          </KpiCard>

          {canSeeFinance ? (
            <KpiCard title="A receber" icon={Coins}>
              <strong className="text-[1.7rem] font-extrabold leading-tight tracking-[-0.03em] tabular-nums sm:text-[2.86rem]">
                <span className="mr-1 text-[1.43rem] font-bold text-muted-foreground">R$</span>
                {formatBRL(receivableTotal)}
              </strong>
              <KpiNote>
                {receivables.length} lançamento{receivables.length === 1 ? "" : "s"} pendente{receivables.length === 1 ? "" : "s"}
              </KpiNote>
            </KpiCard>
          ) : null}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-[var(--gap-grid)] lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_664px]">
          <section className="rounded-lg bg-card px-[var(--pad-card)] pb-2.5 pt-[var(--pad-card)]" aria-labelledby="dash-deadlines">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="dash-deadlines" className="m-0 text-card-title text-ink">Prazos fatais</h2>
                <p className="mt-0.5 text-meta text-muted-foreground">Ordenados por urgência</p>
              </div>
              <Segmented label="Filtro de prioridade" options={PRIORITY_TABS} value={priorityTab} onChange={setPriorityTab} />
            </div>

            {tableRows.length ? (
              <div className="overflow-x-auto">
                <div className="min-w-[560px]">
                  <div className={cn("grid gap-3 border-b border-line px-3 py-2.5 text-label uppercase text-subtle", ROW_GRID)}>
                    <span>Prazo</span>
                    <span>Cliente</span>
                    <span>Vence</span>
                    <span>Prioridade</span>
                  </div>
                  {tableRows.map((deadline) => {
                    const due = formatRelativeDue(deadline.date, today);
                    return (
                      <Link
                        key={deadline.id}
                        to={`/prazos/${deadline.id}`}
                        className={cn(
                          "grid items-center gap-3 rounded-md border-b border-line px-3 py-3.5 transition-colors last:border-b-0 hover:bg-surface-2",
                          ROW_GRID,
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar name={deadline.responsibleName} seed={deadline.responsible || deadline.responsibleName} size={34} />
                          <div className="min-w-0">
                            <strong className="block truncate text-[1rem] font-bold text-ink">{deadline.title}</strong>
                            <StatusBadge tone={getStatusTone(deadline.status, deadline.completed)}>
                              {deadline.status || "Monitorado"}
                            </StatusBadge>
                          </div>
                        </div>
                        <span className="min-w-0 truncate text-meta font-semibold text-ink-2" title={clientName(deadline.clientId) || deadline.clientName}>
                          {clientName(deadline.clientId) || deadline.clientName || "—"}
                        </span>
                        <div className="flex flex-col leading-tight">
                          <strong className={cn("text-meta font-bold tabular-nums", due.days <= 1 ? "text-[var(--danger-ink)]" : "text-ink")}>
                            {due.label}
                          </strong>
                          <span className="text-meta-sm text-subtle tabular-nums">{formatDate(deadline.date)}</span>
                        </div>
                        <StatusBadge pill tone={getStatusTone(deadline.priority)}>
                          {deadline.priority || "—"}
                        </StatusBadge>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : (
              <EmptyState title="Sem prazos neste filtro." copy="Tudo em dia." className="border-0 p-0" />
            )}

            <Link
              to="/prazos"
              className="flex items-center justify-center gap-1.5 p-3.5 text-meta font-bold text-ink-2 transition-colors hover:text-ink"
            >
              Abrir quadro de prazos
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Link>
          </section>

          <div className="flex flex-col gap-[var(--gap-grid)] 2xl:grid 2xl:grid-cols-2 2xl:items-start">
            <section className="flex flex-col gap-3.5 rounded-lg bg-card p-[var(--pad-card)] 2xl:col-span-2" aria-label="Próximo prazo">
              <div className="flex items-center justify-between">
                <span className="text-label uppercase text-subtle">Próximo prazo</span>
                {nextDue ? (
                  <span
                    className={cn(
                      "rounded-pill px-2.5 py-1 text-[.86rem] font-extrabold",
                      nextDue.days <= 1 ? "bg-[var(--danger-soft)] text-[var(--danger-ink)]" : "bg-surface-2 text-ink-2",
                    )}
                  >
                    {nextDue.label}
                  </span>
                ) : null}
              </div>
              {nextDeadline ? (
                <>
                  <strong className="text-[1.71rem] font-bold leading-tight tracking-[-0.01em] text-ink">{nextDeadline.title}</strong>
                  <div className="flex flex-col gap-0.5 text-meta text-ink-2">
                    <span>{clientName(nextDeadline.clientId) || nextDeadline.clientName}</span>
                    <span className="tabular-nums text-subtle">
                      {[nextProcess?.number || nextDeadline.processNumber, nextProcess?.court].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <div className="mt-1 flex gap-2">
                    <Button asChild className="flex-1">
                      <Link to={`/prazos/${nextDeadline.id}`}>Abrir prazo</Link>
                    </Button>
                    <Button asChild variant="secondary" className="flex-1">
                      <Link to="/prazos">Ver prazos</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <strong className="text-[1.71rem] font-bold leading-tight text-ink">Sem prazos pendentes.</strong>
                  <p className="m-0 text-meta text-muted-foreground">Prazos aparecem aqui assim que forem criados.</p>
                </>
              )}
            </section>

            <section className="flex flex-col gap-3.5 rounded-lg bg-card p-[var(--pad-card)]" aria-labelledby="dash-today">
              <div className="flex items-center justify-between">
                <h2 id="dash-today" className="m-0 text-card-title-sm text-ink">Hoje</h2>
                <span className="text-meta font-semibold text-muted-foreground">
                  {new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).format(today)}
                </span>
              </div>
              {agenda.length ? (
                agenda.map((event) => (
                  <Link key={event.id} to={`/agenda/${event.id}`} className="grid grid-cols-[52px_minmax(0,1fr)] items-stretch gap-3">
                    <div className="flex flex-col pt-2.5 tabular-nums">
                      <strong className="text-[1rem] font-bold text-ink">{formatTime(event.start)}</strong>
                      <span className="text-[.79rem] font-semibold text-subtle">
                        {isSameDay(event.start, today) ? "Hoje" : "Amanhã"}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5 rounded-md bg-surface-2 px-3.5 py-2.5">
                      <strong className="truncate text-[1rem] font-bold text-ink">{event.title}</strong>
                      <span className="truncate text-meta-sm text-ink-2">
                        {event.location || clientName(event.clientId) || event.clientName || "—"}
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState title="Sem compromissos hoje." copy="Agenda livre." className="border-0 p-0" />
              )}
            </section>

            <section className="flex flex-col gap-[var(--gap-grid)] rounded-lg bg-card p-[var(--pad-card)]" aria-labelledby="dash-week">
              <div className="flex items-baseline justify-between">
                <h2 id="dash-week" className="m-0 text-card-title-sm text-ink">Carga da semana</h2>
                <span className="text-meta-sm font-semibold text-muted-foreground">prazos + compromissos</span>
              </div>
              <WeekLoad days={days} counts={weekCounts} today={today} />
            </section>
          </div>
        </div>
      </MotionDiv>
    </div>
  );
}
