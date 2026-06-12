// Shared helpers for the agenda pages: month grid, day-param parsing, event form validation.
import { isSameDay } from "../utils";

export function monthLabel(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(value);
}

export function calendarDays(viewDate, events) {
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth(),
    1 - startOffset,
  );
  const rows = [];

  for (let index = 0; index < 42; index += 1) {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + index);
    rows.push({
      key: `${cellDate.toISOString()}-${index}`,
      date: cellDate,
      events: events.filter((event) => isSameDay(event.start, cellDate)),
    });
  }

  return rows;
}

export function dayLabel(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDayParam(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDayParam(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const [y, mo, d] = value.split("-").map(Number);
  return new Date(y, mo - 1, d);
}

export function validateEventForm(form) {
  const nextErrors = {};

  if (!form.title.trim()) nextErrors.title = "Informe o título.";
  if (!form.type) nextErrors.type = "Selecione o tipo.";
  if (!form.priority) nextErrors.priority = "Selecione a prioridade.";
  if (!form.start) nextErrors.start = "Informe a data de início.";
  if (!form.end) nextErrors.end = "Informe a data de fim.";
  if (!form.clientId) nextErrors.clientId = "Selecione um cliente.";
  if (!form.processId) nextErrors.processId = "Selecione um processo.";
  if (!form.responsible.trim())
    nextErrors.responsible = "Informe o responsável.";
  if (!form.status) nextErrors.status = "Selecione o status.";
  if (form.start && form.end && new Date(form.end) < new Date(form.start)) {
    nextErrors.end = "O fim deve ser posterior ao início.";
  }

  return nextErrors;
}

export function dateQueryToDateTimeInput(value, time = "18:00") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    return "";
  }

  return `${value}T${time}`;
}

export function safeReturnPath(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "";
  }

  return value;
}
