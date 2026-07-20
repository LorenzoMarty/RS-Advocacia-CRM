import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { PageChrome } from '../layout';
import { normalizeText } from '../utils';

const MANUAL_SECTIONS = [
  {
    id: 'clientes',
    title: 'Clientes',
    bullets: [
      'Lista de clientes com busca e filtro por tipo (Todos, Esporádicos, Mensalistas).',
      'Botão "Novo" cadastra um cliente; "Importar do Drive" abre um assistente que escaneia a pasta "Clientes" do Google Drive em busca de pastas sem cliente cadastrado e permite revisar o nome antes de confirmar.',
      'Cadastro exige Nome, CPF/CNPJ, Telefone e E-mail; "Parceria" é um campo de busca com opção de cadastrar um valor novo na hora.',
      'A tela de detalhe mostra os processos, compromissos e observações do cliente, e no final traz a aba de Documentos (Drive) — ver seção "Documentos".',
      'Um cliente identificado como inativo pelo Drive (pasta sem atividade) ganha um selo "Inativo (Drive)".',
    ],
  },
  {
    id: 'processos',
    title: 'Processos',
    bullets: [
      'Lista com busca única (número, cliente, área, vara, responsável, status) e paginação por "Carregar mais".',
      'Cadastro exige Número, Cliente, Responsável, Status, Área jurídica e Vara — Status/Área/Vara aceitam digitar um valor novo além dos já usados.',
      'Checkbox "Advogado habilitado nos autos" controla um selo de alerta na listagem quando desmarcado.',
      'Na tela de detalhe há atalhos para criar direto um novo compromisso, prazo ou petição já vinculados a esse processo e ao cliente.',
    ],
  },
  {
    id: 'agenda',
    title: 'Agenda',
    bullets: [
      'Visão mensal em calendário, com legenda por tipo de compromisso (Audiência, Reunião, Tarefa) e filtros de busca, tipo, responsável, status e período.',
      'Compromissos podem ser arrastados para outro dia (visão mensal) ou outro horário (visão do dia).',
      'Sincroniza automaticamente com o Google Calendar quando o usuário tem a conta Google conectada.',
      'Painéis laterais mostram compromissos de "Hoje", "Próximos" e "Atrasados".',
      'Cadastro exige Título, Tipo, Prioridade, Início, Fim, Cliente, Processo e Responsável; Lembrete é opcional.',
      'No detalhe do compromisso, os botões "Compareceu" / "Não compareceu" registram o comparecimento.',
    ],
  },
  {
    id: 'prazos',
    title: 'Prazos',
    bullets: [
      'Kanban com colunas A fazer → Em andamento → Protocolar → Protocolado, com cartões arrastáveis entre colunas (ou movidos por um seletor no próprio cartão).',
      'O título do prazo é gerado automaticamente a partir do processo e do responsável — o cadastro só pede Processo, Responsável e uma descrição opcional.',
      'Cada cartão tem um cronômetro de produtividade: iniciar o cronômetro promove automaticamente o prazo de "A fazer" para "Em andamento".',
      'Um prazo que já teve tempo registrado no cronômetro não pode voltar para a coluna "A fazer".',
      'No detalhe é possível criar um documento no Drive para o prazo, enviar um arquivo já pronto, ou remover o vínculo (com opção de apagar o arquivo do Drive também).',
    ],
  },
  {
    id: 'peticoes',
    title: 'Petições ou contestações',
    bullets: [
      'Kanban com as mesmas colunas e a mesma trava de "não volta para Pendente com tempo já registrado" dos Prazos.',
      'Ao iniciar o cronômetro de uma petição pendente, o sistema oferece a opção de já criar o documento no Drive e abri-lo.',
      'Cadastro exige Cliente, Processo vinculado, Tipo de peça, Adverso e Responsável; enquanto não está protocolada, pede também o motivo da pendência.',
      'Na edição, um painel mostra os arquivos já existentes na pasta "Petições" do processo, dentro do Drive do cliente.',
    ],
  },
  {
    id: 'produtividade',
    title: 'Produtividade',
    bullets: [
      'Tela somente leitura: mostra o tempo registrado nos cronômetros de Prazos e Petições, não tem cadastro próprio.',
      'Filtro de período (semana atual ou período personalizado).',
      'Indicadores: tempo total no período (com variação percentual em relação ao período anterior), prazos realizados, petições realizadas, processos acompanhados e média de tempo por tarefa.',
      'Gráfico de distribuição do tempo por tipo de tarefa.',
    ],
  },
  {
    id: 'documentos',
    title: 'Documentos (Google Drive)',
    bullets: [
      'Acessada pela aba de Documentos dentro do detalhe de cada cliente — não é um módulo separado no menu.',
      'Navegador de pastas do Drive com breadcrumb: criar pasta, enviar arquivo (inclusive arrastando e soltando), renomear ou excluir pastas criadas pelo sistema.',
      '"Organizar com IA" analisa os nomes dos arquivos da pasta e sugere um plano de organização, sem nunca ler o conteúdo dos arquivos.',
      'Fica indisponível no modo demo (sem integração Google habilitada), mostrando um aviso explicando o motivo.',
    ],
  },
  {
    id: 'reunioes',
    title: 'Reuniões (transcrição e resumo por IA)',
    bullets: [
      'Lista de reuniões à esquerda e o conteúdo/ata da reunião selecionada à direita.',
      '"Nova" cria uma reunião com Título, Data/horário e Cliente vinculado (opcional).',
      'Gravação de áudio direto do navegador; enquanto a transcrição e o resumo são processados, a tela mostra o andamento e se atualiza sozinha.',
      'O resumo gerado por IA aparece formatado, com seções como Resumo executivo, Pontos discutidos, Próximas ações e Prazos.',
      '"Finalizar reunião" salva o resumo como documento no Google Drive do cliente vinculado.',
      'A transcrição pode ser editada manualmente depois de gerada.',
    ],
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    bullets: [
      'Acesso restrito por permissão — nem todo usuário vê este módulo.',
      'Painel com Recebido no mês, A receber, Atrasado, Despesas no mês e Saldo estimado, além de dois gráficos de rosca (receita e despesa por categoria) que filtram a tabela ao clicar numa fatia.',
      'Abas: A receber, Pagas, Despesas, Cancelados.',
      'Ações por lançamento: Editar, Pagar (marca como pago na data de hoje), Cancelar, Excluir.',
      'Cadastro exige Descrição, Categoria e Valor; a data de pagamento só aparece quando o status já é "Pago". O status em si só muda pelos botões da listagem, não pelo formulário.',
    ],
  },
  {
    id: 'auditoria',
    title: 'Auditoria',
    bullets: [
      'Acesso restrito a usuários com papel Administrador — os demais veem um aviso de acesso restrito.',
      'Visão macro do escritório: resumo de risco, ações prioritárias, status dos processos (incluindo processos parados), painéis de prazos e eventos, funil de petições e produtividade da equipe.',
      'Log de atividades do sistema, com filtros e paginação.',
    ],
  },
  {
    id: 'configuracoes',
    title: 'Configurações',
    bullets: [
      'Cadastro, troca ou remoção da chave de API da OpenAI (fica mascarada depois de salva).',
      'Sem essa chave configurada, os recursos de IA — transcrição, resumo de reuniões e "Organizar com IA" no Drive — ficam indisponíveis.',
      'Painel de custo estimado de IA: total acumulado, mês atual e mês anterior, detalhado por tipo de operação (transcrição, resumo, refinamento de resumo, organização de Drive). É uma estimativa, não o valor exato da fatura da OpenAI.',
    ],
  },
];

function sectionMatches(section, needle) {
  if (!needle) return true;
  const haystack = normalizeText(`${section.title} ${section.bullets.join(' ')}`);
  return haystack.includes(needle);
}

function highlight(text, needle) {
  if (!needle) return text;
  const normalized = normalizeText(text);
  const index = normalized.indexOf(needle);
  if (index === -1) return text;
  const end = index + needle.length;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-primary/20 text-foreground">{text.slice(index, end)}</mark>
      {text.slice(end)}
    </>
  );
}

export function ManualPage() {
  const [search, setSearch] = useState('');
  const needle = normalizeText(search);

  const visibleSections = useMemo(
    () => MANUAL_SECTIONS.filter((section) => sectionMatches(section, needle)),
    [needle],
  );

  function scrollToSection(id) {
    document.getElementById(`manual-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="grid gap-4 pt-5">
      <PageChrome label="Manual do sistema" />

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="grid gap-3 p-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar no manual"
                  className="pl-8"
                  aria-label="Buscar no manual"
                />
              </label>

              <nav aria-label="Índice do manual" className="grid gap-0.5">
                {MANUAL_SECTIONS.map((section) => {
                  const isVisible = sectionMatches(section, needle);
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => scrollToSection(section.id)}
                      disabled={!isVisible}
                      className={cn(
                        'rounded-lg px-2.5 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground',
                        !isVisible && 'pointer-events-none opacity-30',
                      )}
                    >
                      {section.title}
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </aside>

        <main className="grid gap-4">
          {visibleSections.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma seção do manual corresponde à busca "{search}".
              </CardContent>
            </Card>
          ) : (
            visibleSections.map((section) => (
              <Card key={section.id} id={`manual-${section.id}`}>
                <CardContent className="grid gap-2.5 p-5">
                  <h2 className="text-lg font-semibold text-foreground">
                    {highlight(section.title, needle)}
                  </h2>
                  <ul className="grid gap-1.5 text-sm text-muted-foreground">
                    {section.bullets.map((bullet, index) => (
                      <li key={index} className="flex gap-2">
                        <span aria-hidden="true">•</span>
                        <span>{highlight(bullet, needle)}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))
          )}
        </main>
      </div>
    </div>
  );
}
