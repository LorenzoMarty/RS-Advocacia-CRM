import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';

import { INTERACTION_TYPE_OPTIONS } from '../data';
import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { PageChrome, StatusBadge } from '../layout';
import { useAppState } from '../store';
import { formatCount, formatDate, getStatusTone } from '../utils';
import { Select } from '../components/select';
import {
  DetailGrid,
  DetailHero,
  DetailItem,
  DetailLayout,
  DetailSection,
  DetailStack,
  Field,
  NotFoundState,
} from './common';
import { deadlineAuditFor, interactionLabel, priorityLabel } from './prospeccao-utils';

export function ProspectDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const { confirm, confirmPopup } = useConfirmPopup();
  const { prospects, deadlines, addInteracao, convertProspect, deleteProspect } = useAppState();
  const prospect = prospects.find((item) => item.id === params.prospectId) || null;

  const [interactionType, setInteractionType] = useState('ligacao');
  const [interactionText, setInteractionText] = useState('');
  const [showConvert, setShowConvert] = useState(false);
  const [convertForm, setConvertForm] = useState({ cpf: '', tipo_cliente: 'esporadico' });

  if (!prospect) {
    return <NotFoundState title="Prospect não encontrado." />;
  }

  const audit = deadlineAuditFor(prospect.responsibleName, deadlines);
  const interactions = prospect.interactions || [];
  const isConverted = Boolean(prospect.convertedClientId);

  async function handleAddInteraction(event) {
    event.preventDefault();
    if (!interactionText.trim()) return;
    const saved = await addInteracao(prospect.id, {
      type: interactionType,
      description: interactionText.trim(),
    });
    if (saved) {
      setInteractionText('');
    }
  }

  async function handleConvert(event) {
    event.preventDefault();
    const ok = await confirm({
      title: 'Converter em cliente?',
      message: `${prospect.name} será cadastrado como cliente real.`,
      confirmLabel: 'Converter',
      tone: 'default',
    });
    if (!ok) return;
    const result = await convertProspect(prospect.id, {
      cpf: convertForm.cpf,
      tipo_cliente: convertForm.tipo_cliente,
    });
    if (result?.client) {
      navigate(`/clientes/${result.client.id}`);
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: 'Tem certeza?',
      message: `O prospect "${prospect.name}" será deletado.`,
      confirmLabel: 'Deletar',
      tone: 'danger',
    });
    if (!ok) return;
    const deleted = await deleteProspect(prospect.id);
    if (deleted) {
      navigate('/prospeccao', { replace: true });
    }
  }

  return (
    <>
      {confirmPopup}
      <PageChrome label="Prospect" />

      <div className="grid gap-4">
        <DetailHero
          breadcrumbLabel="Prospecção"
          breadcrumbTo="/prospeccao"
          mark={prospect.name.slice(0, 1).toUpperCase()}
          title={prospect.name}
          subtitle={prospect.demandType || 'Demanda não informada'}
          summary={[
            { label: 'Status', value: <StatusBadge tone={getStatusTone(prospect.status)}>{prospect.status}</StatusBadge> },
            { label: 'Prioridade', value: priorityLabel(prospect.priority) },
            { label: 'Responsável', value: prospect.responsibleName || '-' },
          ]}
          actions={
            <>
              <Button asChild variant="outline">
                <Link to={`/prospeccao/${prospect.id}/editar`}>Editar</Link>
              </Button>
              <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={handleDelete}>
                Excluir
              </Button>
            </>
          }
        />

        <DetailLayout>
          <DetailStack>
            <DetailSection title="Dados" note="Essenciais">
              <DetailGrid>
                <DetailItem label="Telefone">{prospect.phone || '-'}</DetailItem>
                <DetailItem label="E-mail">{prospect.email || '-'}</DetailItem>
                <DetailItem label="Origem">{prospect.origin || '-'}</DetailItem>
                <DetailItem label="Responsável">{prospect.responsibleName || '-'}</DetailItem>
                <DetailItem label="Prioridade">{priorityLabel(prospect.priority)}</DetailItem>
                <DetailItem label="Próxima ação">{prospect.nextAction || '-'}</DetailItem>
              </DetailGrid>

              {audit.active ? (
                <p className={`prospect-audit${audit.critical ? ' is-critical' : ''}`}>
                  Responsável com <strong>{audit.active}</strong> prazo(s) ativo(s)
                  {audit.critical ? <> · <strong>{audit.critical}</strong> crítico(s)</> : null}
                </p>
              ) : null}

              {prospect.caseDescription ? (
                <div className="prospect-case-box">{prospect.caseDescription}</div>
              ) : null}
            </DetailSection>

            <DetailSection title="Conversão" note="Transforme o prospect em cliente real">
              {isConverted ? (
                <p className="prospect-converted">
                  Convertido. <Link className="text-primary hover:underline" to={`/clientes/${prospect.convertedClientId}`}>Ver cliente</Link>
                </p>
              ) : showConvert ? (
                <form className="prospect-convert-form" onSubmit={handleConvert}>
                  <div className="form-grid">
                    <Field id="convert-cpf" label="CPF/CNPJ (opcional)">
                      <input
                        id="convert-cpf"
                        value={convertForm.cpf}
                        onChange={(event) => setConvertForm((c) => ({ ...c, cpf: event.target.value }))}
                      />
                    </Field>
                    <Field id="convert-type" label="Tipo de cliente">
                      <Select
                        id="convert-type"
                        value={convertForm.tipo_cliente}
                        onChange={(event) => setConvertForm((c) => ({ ...c, tipo_cliente: event.target.value }))}
                      >
                        <option value="esporadico">Esporádico</option>
                        <option value="mensalista">Mensalista</option>
                      </Select>
                    </Field>
                  </div>
                  <div className="form-actions">
                    <Button type="submit">Confirmar conversão</Button>
                    <Button variant="outline" type="button" onClick={() => setShowConvert(false)}>Cancelar</Button>
                  </div>
                </form>
              ) : (
                <Button type="button" onClick={() => setShowConvert(true)}>Converter em cliente</Button>
              )}
            </DetailSection>
          </DetailStack>

          <DetailStack>
            <DetailSection title="Interações" note={formatCount(interactions.length, 'interação', 'interações')}>
              <form className="prospect-interaction-form" onSubmit={handleAddInteraction}>
                <Select value={interactionType} onChange={(event) => setInteractionType(event.target.value)}>
                  {INTERACTION_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
                <input
                  value={interactionText}
                  onChange={(event) => setInteractionText(event.target.value)}
                  placeholder="Descreva a interação"
                />
                <Button type="submit">Registrar</Button>
              </form>

              {interactions.length ? (
                <ul className="prospect-timeline">
                  {interactions.map((interaction) => (
                    <li key={interaction.id}>
                      <div className="prospect-timeline-head">
                        <StatusBadge tone="gold">{interactionLabel(interaction.type)}</StatusBadge>
                        <span>{interaction.date ? formatDate(interaction.date) : ''}</span>
                      </div>
                      <p>{interaction.description}</p>
                      {interaction.userName ? <small>{interaction.userName}</small> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma interação registrada.</p>
              )}
            </DetailSection>
          </DetailStack>
        </DetailLayout>
      </div>
    </>
  );
}
