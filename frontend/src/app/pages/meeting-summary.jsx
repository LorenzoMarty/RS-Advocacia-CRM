import { PROCESSING_STEPS } from './meetings-utils';

export function RecordingPipeline({ status }) {
  if (status === 'falhou') {
    return null;
  }

  const currentIndex = PROCESSING_STEPS.findIndex((step) => step.key === status);
  const activeIndex = currentIndex === -1 ? 0 : currentIndex;

  return (
    <ol className="m-0 flex list-none flex-wrap items-center gap-x-3.5 gap-y-1.5 p-0" aria-label="Progresso do processamento">
      {PROCESSING_STEPS.map((step, index) => {
        const state = index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending';
        return (
          <li key={step.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={
                state === 'done'
                  ? 'h-2 w-2 flex-none rounded-full border border-success bg-success'
                  : state === 'active'
                    ? 'h-2 w-2 flex-none animate-pulse rounded-full border border-primary bg-primary'
                    : 'h-2 w-2 flex-none rounded-full border border-border bg-border'
              }
              aria-hidden="true"
            />
            <span className={state === 'done' ? 'text-muted-foreground' : state === 'active' ? 'font-semibold text-foreground' : ''}>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const SUMMARY_SECTION_LABELS = {
  resumo_executivo: 'Resumo executivo',
  tipo_reuniao: 'Tipo de reunião',
  participantes: 'Participantes',
  pontos_discutidos: 'Pontos discutidos',
  analise_juridica: 'Análise jurídica',
  estrategias_decisoes: 'Estratégias e decisões',
  proximas_acoes: 'Próximas ações',
  responsabilidades_escritorio: 'Responsabilidades do escritório',
  responsabilidades_parceiros: 'Responsabilidades dos parceiros',
  responsabilidades_cliente: 'Responsabilidades do cliente',
  pendencias_operacionais: 'Pendências operacionais',
  prazos: 'Prazos',
  compromissos: 'Compromissos',
  provas_documentos: 'Provas e documentos',
  materiais_existentes: 'Materiais existentes',
  materiais_pendentes: 'Materiais pendentes',
  pendencias_riscos: 'Pendências e riscos',
  checklist_final: 'Checklist final',
};

function humanizeSummaryTag(tag) {
  return SUMMARY_SECTION_LABELS[tag] || tag
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function appendTextNode(node, value) {
  if (value.trim()) {
    node.children.push({ type: 'text', value });
  }
}

function parseTaggedSummary(value) {
  const root = { type: 'root', children: [] };
  const stack = [root];
  const tagPattern = /<\/?([a-zA-Z][\w-]*)>/g;
  let lastIndex = 0;
  let match = tagPattern.exec(value);

  while (match) {
    appendTextNode(stack[stack.length - 1], value.slice(lastIndex, match.index));

    const [, tagName] = match;
    const isClosingTag = match[0].startsWith('</');

    if (isClosingTag) {
      let openIndex = -1;
      for (let index = stack.length - 1; index > 0; index -= 1) {
        if (stack[index].tag === tagName) {
          openIndex = index;
          break;
        }
      }

      if (openIndex > 0) {
        stack.length = openIndex;
      }
    } else {
      const nextNode = { type: 'section', tag: tagName, title: humanizeSummaryTag(tagName), children: [] };
      stack[stack.length - 1].children.push(nextNode);
      stack.push(nextNode);
    }

    lastIndex = tagPattern.lastIndex;
    match = tagPattern.exec(value);
  }

  appendTextNode(stack[stack.length - 1], value.slice(lastIndex));
  return root.children;
}

function parseMarkdownSummary(value) {
  const root = { type: 'root', level: 0, children: [] };
  const stack = [root];
  const lines = value.split(/\r?\n/);

  lines.forEach((line) => {
    const heading = /^(#{2,4})\s+(.+)$/.exec(line.trim());

    if (!heading) {
      appendTextNode(stack[stack.length - 1], `${line}\n`);
      return;
    }

    const level = heading[1].length - 1;
    const nextNode = {
      type: 'section',
      level,
      title: heading[2].trim(),
      children: [],
    };

    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    stack[stack.length - 1].children.push(nextNode);
    stack.push(nextNode);
  });

  return root.children;
}

function cleanSummaryLine(line) {
  return line
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/^\[\s?[xX]?\s?\]\s*/, '')
    .trim();
}

function renderTextBlock(value, keyPrefix) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const blocks = [];
  let listItems = [];
  let checklistItems = [];

  function flushLists() {
    if (checklistItems.length) {
      blocks.push(
        <ul className="m-0 grid list-none gap-1.5 p-0" key={`${keyPrefix}-check-${blocks.length}`}>
          {checklistItems.map((item, index) => (
            <li className="flex items-start gap-2" key={`${keyPrefix}-check-item-${index}`}>
              <span
                aria-hidden="true"
                className="mt-0.5 h-[15px] w-[15px] flex-none rounded-[5px] border border-primary/35 bg-primary/10"
              />
              <p className="m-0">{cleanSummaryLine(item)}</p>
            </li>
          ))}
        </ul>,
      );
      checklistItems = [];
    }

    if (listItems.length) {
      blocks.push(
        <ul className="m-0 grid gap-1.5 pl-[18px] marker:text-primary" key={`${keyPrefix}-list-${blocks.length}`}>
          {listItems.map((item, index) => (
            <li key={`${keyPrefix}-list-item-${index}`}>{cleanSummaryLine(item)}</li>
          ))}
        </ul>,
      );
      listItems = [];
    }
  }

  lines.forEach((line) => {
    if (/^[-*]\s+\[[ xX]\]\s+/.test(line)) {
      if (listItems.length) {
        flushLists();
      }
      checklistItems.push(line);
      return;
    }

    if (/^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      if (checklistItems.length) {
        flushLists();
      }
      listItems.push(line);
      return;
    }

    flushLists();
    blocks.push(<p className="m-0" key={`${keyPrefix}-p-${blocks.length}`}>{line}</p>);
  });

  flushLists();
  return blocks;
}

function renderSummaryNodes(nodes, level = 0, keyPrefix = 'summary') {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;

    if (node.type === 'text') {
      return renderTextBlock(node.value, key);
    }

    const textChildren = node.children.filter((child) => child.type === 'text');
    const sectionChildren = node.children.filter((child) => child.type === 'section');

    return (
      <section
        className={
          level > 0
            ? 'grid gap-2 rounded-xl bg-white/[.028] p-3'
            : 'grid gap-2 rounded-xl border border-border bg-muted/40 p-4'
        }
        key={key}
      >
        <header className="flex items-center gap-2">
          <span aria-hidden="true" className="h-[7px] w-[7px] flex-none rounded-full bg-primary" />
          <h4 className="m-0 text-xs font-bold uppercase tracking-wide text-foreground">{node.title}</h4>
        </header>
        <div className="grid gap-2 text-sm leading-relaxed text-muted-foreground">
          {textChildren.flatMap((child, childIndex) => renderTextBlock(child.value, `${key}-text-${childIndex}`))}
          {sectionChildren.length ? (
            <div className="grid gap-2">
              {renderSummaryNodes(sectionChildren, level + 1, key)}
            </div>
          ) : null}
        </div>
      </section>
    );
  });
}

export function MeetingSummary({ value }) {
  const normalizedValue = value.trim();
  const hasXmlLikeSections = /<([a-zA-Z][\w-]*)>/.test(normalizedValue);
  const nodes = hasXmlLikeSections
    ? parseTaggedSummary(normalizedValue)
    : parseMarkdownSummary(normalizedValue);

  return (
    <div className="grid gap-3">
      {nodes.length ? renderSummaryNodes(nodes) : renderTextBlock(normalizedValue, 'summary-plain')}
    </div>
  );
}
