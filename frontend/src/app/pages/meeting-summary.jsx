import { PROCESSING_STEPS } from './meetings-utils';

export function RecordingPipeline({ status }) {
  if (status === 'falhou') {
    return null;
  }

  const currentIndex = PROCESSING_STEPS.findIndex((step) => step.key === status);
  const activeIndex = currentIndex === -1 ? 0 : currentIndex;

  return (
    <ol className="recording-pipeline" aria-label="Progresso do processamento">
      {PROCESSING_STEPS.map((step, index) => {
        const state = index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending';
        return (
          <li key={step.key} className={`recording-step recording-step-${state}`}>
            <span className="recording-step-dot" aria-hidden="true" />
            <span className="recording-step-label">{step.label}</span>
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
        <ul className="summary-checklist" key={`${keyPrefix}-check-${blocks.length}`}>
          {checklistItems.map((item, index) => (
            <li className="summary-checkitem" key={`${keyPrefix}-check-item-${index}`}>
              <span aria-hidden="true" />
              <p>{cleanSummaryLine(item)}</p>
            </li>
          ))}
        </ul>,
      );
      checklistItems = [];
    }

    if (listItems.length) {
      blocks.push(
        <ul className="summary-list" key={`${keyPrefix}-list-${blocks.length}`}>
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
    blocks.push(<p key={`${keyPrefix}-p-${blocks.length}`}>{line}</p>);
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
        className={`summary-section${level > 0 ? ' summary-section-nested' : ''}`}
        key={key}
      >
        <header className="summary-section-header">
          <h4>{node.title}</h4>
        </header>
        <div className="summary-section-body">
          {textChildren.flatMap((child, childIndex) => renderTextBlock(child.value, `${key}-text-${childIndex}`))}
          {sectionChildren.length ? (
            <div className="summary-subsections">
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
    <div className="summary-report">
      {nodes.length ? renderSummaryNodes(nodes) : renderTextBlock(normalizedValue, 'summary-plain')}
    </div>
  );
}
