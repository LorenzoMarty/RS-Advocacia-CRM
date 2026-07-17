import { Link } from "react-router-dom";
import { Plus, Users, Briefcase, FileClock, FileText, ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { PageChrome, StatusBadge } from "../layout";
import { motion, fadeUp, cardHover } from "../motion";
import { useAppState } from "../store";
import { formatTime, getStatusTone, isSameDay, startOfDay } from "../utils";
import { EmptyState } from "./common";

const MotionLink = motion(Link);

const SHORTCUTS = [
  { to: "/agenda/novo", label: "Compromisso", tour: "shortcut-novo-compromisso", Icon: Plus },
  { to: "/clientes/novo", label: "Cliente", tour: "shortcut-novo-cliente", Icon: Users },
  { to: "/processos/novo", label: "Processo", tour: "shortcut-novo-processo", Icon: Briefcase },
  { to: "/prazos/novo", label: "Prazo", tour: "shortcut-novo-prazo", Icon: FileClock },
  { to: "/peticoes-contestacoes", label: "Petições", tour: "shortcut-peticoes", Icon: FileText },
];

function greeting(name) {
  const hour = new Date().getHours();
  const firstName = name?.split(" ")[0] || "";
  const period = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  return firstName ? `${period}, ${firstName}.` : `${period}.`;
}

const WEEKDAY_LETTERS = ["S", "T", "Q", "Q", "S", "S", "D"];

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

// Carga da semana: prazos vencendo + compromissos por dia, pra dar contexto
// de "hoje é o dia mais cheio" sem virar mais um número solto no topo.
function WeekLoadSpark({ today, deadlines, events }) {
  const days = weekDays(today);
  const counts = days.map((day) => {
    const dueDeadlines = deadlines.filter(
      (deadline) => !deadline.completed && isSameDay(deadline.date, day),
    ).length;
    const dayEvents = events.filter((event) => isSameDay(event.start, day)).length;
    return dueDeadlines + dayEvents;
  });
  const max = Math.max(1, ...counts);

  return (
    <div className="mt-3 flex items-end gap-1.5" aria-hidden="true">
      {days.map((day, index) => (
        <div key={day.toISOString()} className="flex flex-col items-center gap-1">
          <div
            className={cn(
              "w-1.5 rounded-sm bg-border",
              isSameDay(day, today) && "bg-primary",
            )}
            style={{ height: `${4 + (counts[index] / max) * 18}px` }}
          />
          <span className="text-[.62rem] text-muted-foreground">{WEEKDAY_LETTERS[index]}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { clients, currentUser, deadlines, events, processes } = useAppState();
  const today = new Date();

  const eventsToday = events
    .filter((event) => isSameDay(event.start, today))
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  const todayStart = startOfDay(today);
  const pendingDeadlines = deadlines.filter((deadline) => !deadline.completed);
  const overdueDeadlines = pendingDeadlines.filter(
    (deadline) => startOfDay(deadline.date) < todayStart,
  );
  const dueTodayDeadlines = pendingDeadlines.filter((deadline) =>
    isSameDay(deadline.date, today),
  );
  const criticalDeadlines = pendingDeadlines
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);
  const nextDeadline = criticalDeadlines[0] || null;

  const focusParts = [];
  if (overdueDeadlines.length) {
    focusParts.push(
      `${overdueDeadlines.length} prazo${overdueDeadlines.length > 1 ? "s" : ""} atrasado${overdueDeadlines.length > 1 ? "s" : ""}`,
    );
  }
  if (dueTodayDeadlines.length) {
    focusParts.push(
      `${dueTodayDeadlines.length} vence${dueTodayDeadlines.length > 1 ? "m" : ""} hoje`,
    );
  }
  if (eventsToday.length) {
    focusParts.push(
      `${eventsToday.length} compromisso${eventsToday.length > 1 ? "s" : ""} hoje`,
    );
  }

  return (
    <div className="dashboard-page">
      <PageChrome label="Painel" />

      <section className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-serif text-3xl text-foreground">{greeting(currentUser?.name)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {focusParts.length
                ? focusParts.join(" · ")
                : "Nada urgente agora."}
            </p>
            <WeekLoadSpark today={today} deadlines={deadlines} events={events} />
          </div>
          <Button asChild>
            <Link to="/agenda/novo">
              <Plus className="size-4" />
              Novo compromisso
            </Link>
          </Button>
        </div>
      </section>

      <motion.div
        className="grid grid-cols-1 gap-4 lg:grid-cols-3"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
      >
        {/* Coluna principal — protagonista: o dia de hoje e os prazos críticos */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div>
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <h2 className="font-serif text-lg text-foreground">Hoje</h2>
                  <p className="text-xs text-muted-foreground">Compromissos do dia</p>
                </div>
                {eventsToday.length ? (
                  <Badge variant="default">{eventsToday.length}</Badge>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                {eventsToday.length ? (
                  eventsToday.map((event) => (
                    <MotionLink
                      key={event.id}
                      to={`/agenda/${event.id}`}
                      className="flex items-center gap-4 rounded-md px-3 py-2.5 -mx-3 transition-colors hover:bg-accent/10"
                      {...cardHover}
                    >
                      <div className="w-14 shrink-0 text-sm tabular-nums text-muted-foreground">
                        {formatTime(event.start)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {event.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[
                            clients.find((c) => c.id === event.clientId)?.name,
                            processes.find((p) => p.id === event.processId)?.number,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <StatusBadge tone={getStatusTone(event.status, event.completed)}>
                        {event.completed ? "Concluído" : event.status}
                      </StatusBadge>
                    </MotionLink>
                  ))
                ) : (
                  <EmptyState
                    title="Sem compromissos hoje."
                    copy="Agenda livre."
                    className="border-0 p-0"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <h2 className="font-serif text-lg text-foreground">Prazos fatais</h2>
                  <p className="text-xs text-muted-foreground">Ordenados por urgência</p>
                </div>
                {pendingDeadlines.length ? (
                  <Badge variant={overdueDeadlines.length ? "destructive" : "warn"}>
                    {pendingDeadlines.length}
                  </Badge>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                {criticalDeadlines.length ? (
                  criticalDeadlines.map((deadline) => {
                    const isOverdue = startOfDay(deadline.date) < todayStart;
                    const isToday = isSameDay(deadline.date, today);
                    return (
                      <MotionLink
                        key={deadline.id}
                        to={`/prazos/${deadline.id}`}
                        className="flex items-center gap-4 rounded-md px-3 py-2.5 -mx-3 transition-colors hover:bg-accent/10"
                        {...cardHover}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {deadline.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[
                              clients.find((c) => c.id === deadline.clientId)?.name,
                              processes.find((p) => p.id === deadline.processId)?.number,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <Badge variant={isOverdue ? "destructive" : isToday ? "warn" : "outline"}>
                          {isOverdue ? "Atrasado" : isToday ? "Hoje" : "Em dia"}
                        </Badge>
                      </MotionLink>
                    );
                  })
                ) : (
                  <EmptyState
                    title="Sem prazos pendentes."
                    copy="Tudo em dia."
                    className="border-0 p-0"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Rail — apoio: próximo prazo em foco + atalhos rebaixados */}
        <div className="flex flex-col gap-4">
          <div>
            <Card className={cn(nextDeadline && "border-primary/30")}>
              <CardHeader className="pb-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Próximo prazo
                </p>
              </CardHeader>
              <CardContent>
                {nextDeadline ? (
                  <>
                    <h3 className="font-serif text-xl text-foreground">
                      {nextDeadline.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[
                        clients.find((c) => c.id === nextDeadline.clientId)?.name,
                        processes.find((p) => p.id === nextDeadline.processId)?.number,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <StatusBadge
                      tone={getStatusTone(nextDeadline.status, nextDeadline.completed)}
                      className="mt-3"
                    >
                      {nextDeadline.status || "Monitorado"}
                    </StatusBadge>
                  </>
                ) : (
                  <>
                    <h3 className="font-serif text-xl text-foreground">
                      Sem prazos pendentes.
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Prazos aparecem aqui assim que forem criados.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader className="pb-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Atalhos
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-0.5">
                {SHORTCUTS.map((shortcut) => (
                  <Link
                    key={shortcut.to}
                    to={shortcut.to}
                    data-tour={shortcut.tour}
                    className="flex items-center gap-3 rounded-md px-2 py-2 -mx-2 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
                  >
                    <shortcut.Icon className="size-4 shrink-0" />
                    <span className="flex-1">{shortcut.label}</span>
                    <ChevronRight className="size-3.5 shrink-0 opacity-50" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
