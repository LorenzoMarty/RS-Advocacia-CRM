import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

import { api } from '../api';
import { searchGroupsFromResponse } from '../mappers';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

// Busca global da topbar: consulta o servidor (`/api/busca/`, com debounce), então acha
// registros que o estado carregado não tem. ⌘K / Ctrl+K foca o campo; Enter abre o primeiro resultado.
export function GlobalSearch() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const boxRef = useRef(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState({ term: '', groups: [], failed: false });

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    function onPointerDown(event) {
      if (!boxRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  const term = query.trim();
  const isSearchable = term.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!isSearchable) return undefined;
    let stale = false;
    const timer = setTimeout(() => {
      api.search(term).then(
        (payload) => !stale && setResult({ term, groups: searchGroupsFromResponse(payload), failed: false }),
        () => !stale && setResult({ term, groups: [], failed: true }),
      );
    }, DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [term, isSearchable]);

  // Só vale o resultado da consulta atual; enquanto ela não volta, mostra "Buscando…".
  const isCurrent = result.term === term;
  const groups = isCurrent ? result.groups : [];

  function go(to) {
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    navigate(to);
  }

  return (
    <div ref={boxRef} className="relative min-w-0 max-lg:hidden">
      <label className="flex h-11 w-[320px] items-center gap-2.5 rounded-pill bg-surface-2 px-4 text-muted-foreground focus-within:ring-2 focus-within:ring-[var(--focus-ring)]">
        <Search className="size-[17px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Buscar clientes, processos, prazos…"
          aria-label="Busca global"
          className="min-w-0 flex-1 border-0 bg-transparent text-[1rem] text-ink outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              event.currentTarget.blur();
            } else if (event.key === 'Enter' && groups[0]) {
              go(groups[0].items[0].to);
            }
          }}
        />
        <kbd className="rounded-[6px] border border-solid border-line-strong px-1.5 text-[11px] font-bold leading-[18px]">⌘K</kbd>
      </label>

      {open && isSearchable ? (
        <div className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-[420px] overflow-y-auto rounded-lg bg-card p-2 shadow-pop">
          {!isCurrent ? (
            <p className="m-0 px-3 py-4 text-center text-[.93rem] font-semibold text-muted-foreground">Buscando…</p>
          ) : result.failed ? (
            <p className="m-0 px-3 py-4 text-center text-[.93rem] font-semibold text-muted-foreground">Não foi possível buscar. Tente de novo.</p>
          ) : groups.length ? (
            groups.map((group) => (
              <div key={group.label} className="py-1">
                <span className="block px-3 pb-1 pt-1 text-[11px] font-bold uppercase tracking-[.08em] text-subtle">{group.label}</span>
                {group.items.map((item) => (
                  <button
                    key={`${group.label}-${item.key}`}
                    type="button"
                    className="flex w-full min-w-0 flex-col rounded-sm px-3 py-2 text-left transition-colors hover:bg-surface-2"
                    onClick={() => go(item.to)}
                  >
                    <strong className="truncate text-[1rem] font-bold text-ink">{item.title}</strong>
                    {item.meta ? <span className="truncate text-[.86rem] text-muted-foreground">{item.meta}</span> : null}
                  </button>
                ))}
              </div>
            ))
          ) : (
            <p className="m-0 px-3 py-4 text-center text-[.93rem] font-semibold text-muted-foreground">Nenhum resultado.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
