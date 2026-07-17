import { Children, cloneElement, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';

import { AnimatePresence, motion as Motion } from '../motion';
import { Select } from '../components/select';
import { useAppState } from '../store';
import { formatPhone, getClientTypeLabel } from '../utils';

// Mini-cartão reusável em qualquer tela que só referencia o cliente pelo
// nome (Processos, Prazos, Financeiro...) — contato, tier e nº de processos
// no hover, sem precisar navegar até Clientes.
export function ClientHoverCard({ clientId, children }) {
  const { clients, processes } = useAppState();
  const client = clients.find((item) => item.id === clientId);

  if (!client) {
    return children;
  }

  const processCount = processes.filter((process) => process.clientId === clientId).length;

  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent align="start">
        <div className="flex items-start gap-3">
          <div
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-sm font-bold text-primary"
            aria-hidden="true"
          >
            {client.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{client.name}</p>
            <Badge variant="outline" className="mt-1 uppercase tracking-wide">
              {getClientTypeLabel(client.clientType)}
            </Badge>
          </div>
        </div>
        <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
          {client.email ? <span className="truncate">{client.email}</span> : null}
          {client.phone ? <span>{formatPhone(client.phone)}</span> : null}
          <span>{processCount} processo{processCount === 1 ? '' : 's'}</span>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

// Padrão compartilhado de tela de detalhe (Cliente/Processo/Usuário/Compromisso):
// breadcrumb + hero com marca/título/subtítulo + resumo opcional, layout 2 colunas
// de section cards. Substitui o CSS legado duplicado por página (client-hero,
// process-hero, user-hero...) por um único conjunto de componentes Tailwind/shadcn.
export function DetailHero({ breadcrumbLabel, breadcrumbTo, mark, title, subtitle, meta, summary, actions }) {
  return (
    <section className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          to={breadcrumbTo}
        >
          <ArrowLeft className="size-3.5" />
          {breadcrumbLabel}
        </Link>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div
          className="grid size-14 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 font-serif text-xl text-primary"
          aria-hidden="true"
        >
          {mark}
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-serif text-3xl leading-none text-foreground">{title}</h1>
          {subtitle ? <p className="mt-1.5 truncate text-sm text-muted-foreground">{subtitle}</p> : null}
          {meta ? <div className="mt-2 flex flex-wrap gap-1.5">{meta}</div> : null}
        </div>
      </div>

      {summary?.length ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {summary.map((item) => (
            <div key={item.label} className="rounded-xl border border-border bg-accent/5 px-3 py-2.5">
              <span className="block text-xs uppercase tracking-wide text-muted-foreground">{item.label}</span>
              <div className="mt-1 text-sm font-semibold text-foreground">{item.value}</div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function DetailLayout({ children }) {
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{children}</div>;
}

export function DetailStack({ children }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

export function DetailSection({ title, note, badge, children }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <h2 className="font-serif text-lg text-foreground">{title}</h2>
          {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
        </div>
        {badge}
      </CardHeader>
      <CardContent className="flex flex-col gap-1">{children}</CardContent>
    </Card>
  );
}

export function DetailGrid({ children }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

export function DetailItem({ label, children, span }) {
  return (
    <div className={cn('min-w-0', span && 'sm:col-span-2')}>
      <span className="block text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="mt-1 truncate text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}

// Linha de item relacionado (compromisso/prazo/peça dentro de um DetailSection) —
// título + subtítulo + badge de status + chips de metadados.
export function RelatedItem({ title, subtitle, badge, chips }) {
  return (
    <article className="rounded-xl border border-border bg-accent/5 px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-foreground">{title}</h3>
          {subtitle ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {badge}
      </div>
      {chips?.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((chip, index) => (
            <span
              key={index}
              className="inline-flex h-6 items-center truncate rounded-full border border-border bg-accent/10 px-2 text-xs text-muted-foreground"
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

const CUSTOM_OPTION = '__custom__';

const FIELD_ERROR_MOTION = {
  initial: { opacity: 0, y: -4, height: 0 },
  animate: { opacity: 1, y: 0, height: 'auto' },
  exit: { opacity: 0, y: -4, height: 0 },
  transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
};

// Select com opção de digitar um valor novo (combobox). Usa o <Select> custom; no modo "custom"
// renderiza um input no lugar. O <Select> é um componente React (sem manipulação imperativa da DOM),
// então alternar entre os dois modos é seguro — sem o antigo problema de removeChild.
export function ComboField({
  id,
  value,
  options,
  onChange,
  selectPlaceholder = 'Selecione',
  customLabel = '+ Digitar novo…',
  customPlaceholder = 'Digite o novo valor',
}) {
  const known = [...new Set([...(value ? [value] : []), ...options].filter(Boolean))];
  const [mode, setMode] = useState(() => (value && !options.filter(Boolean).includes(value) ? 'custom' : 'select'));
  const inputRef = useRef(null);

  useEffect(() => {
    if (mode === 'custom') {
      inputRef.current?.focus();
    }
  }, [mode]);

  const isCustom = mode === 'custom';

  return isCustom ? (
    <div className="type-combo">
      <input
        ref={inputRef}
        id={id}
        value={value}
        placeholder={customPlaceholder}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="type-combo-back"
        onClick={() => {
          setMode('select');
          onChange(known[0] || '');
        }}
      >
        ← Selecionar
      </button>
    </div>
  ) : (
    <Select
      id={id}
      value={value}
      onChange={(event) => {
        if (event.target.value === CUSTOM_OPTION) {
          setMode('custom');
          onChange('');
        } else {
          onChange(event.target.value);
        }
      }}
    >
      <option value="">{selectPlaceholder}</option>
      {known.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
      <option value={CUSTOM_OPTION}>{customLabel}</option>
    </Select>
  );
}

export function EmptyState({ title, copy, actions = null, className = '' }) {
  return (
    <div className={cn('rounded-xl border border-dashed border-border px-6 py-10 text-center', className)}>
      <strong className="block text-sm font-semibold text-foreground">{title}</strong>
      {copy ? <p className="mt-1.5 text-sm text-muted-foreground">{copy}</p> : null}
      {actions ? <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Field({
  id,
  label,
  error = '',
  className = '',
  children,
  headLink = null,
  note = null,
  required = false,
}) {
  const errorId = error && id ? `${id}-error` : undefined;
  let content = children;
  if (errorId) {
    try {
      content = cloneElement(Children.only(children), {
        'aria-invalid': 'true',
        'aria-describedby': errorId,
      });
    } catch {
      content = children;
    }
  }
  const labelNode = (
    <label htmlFor={id}>
      {label}
      {required ? <span className="field-required" aria-hidden="true"> *</span> : null}
    </label>
  );
  return (
    <div className={`field${error ? ' has-error' : ''}${className ? ` ${className}` : ''}`}>
      {headLink ? (
        <div className="field-head">
          {labelNode}
          {headLink}
        </div>
      ) : (
        labelNode
      )}
      {content}
      {note ? <p className="field-help">{note}</p> : null}
      <AnimatePresence initial={false}>
        {error ? (
          <Motion.div
            key="field-error"
            id={errorId}
            className="field-error"
            role="alert"
            style={{ overflow: 'hidden' }}
            {...FIELD_ERROR_MOTION}
          >
            {error}
          </Motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function NotFoundState({ title = 'Registro não encontrado.', copy = 'Volte para a listagem e selecione outro item.' }) {
  return (
    <Card>
      <CardContent className="px-6 py-10 text-center">
        <strong className="block text-sm font-semibold text-foreground">{title}</strong>
        <p className="mt-1.5 text-sm text-muted-foreground">{copy}</p>
      </CardContent>
    </Card>
  );
}
