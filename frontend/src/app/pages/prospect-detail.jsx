import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { INTERACTION_TYPE_OPTIONS } from '../data';
import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { PageChrome, StatusBadge } from '../layout';
import { useAppState } from '../store';
import { formatCount, formatDate, getStatusTone } from '../utils';
import { Select } from '../components/select';
import { Field, NotFoundState } from './common';
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
      <PageChrome
        label="Prospect"
        actions={
          <>
            <Link className="btn btn-secondary" to={`/prospeccao/${prospect.id}/editar`}>Editar</Link>
            <button className="btn btn-danger" type="button" onClick={handleDelete}>Excluir</button>
          </>
        }
      />

      <div className="prospect-detail-page">
        <section className="surface section-card">
          <div className="crumbs"><Link to="/prospeccao">Prospecção</Link></div>
          <div className="prospect-detail-head">
            <div>
              <h1 className="intro-title">{prospect.name}</h1>
              <p className="section-note">{prospect.demandType || 'Demanda não informada'}</p>
            </div>
            <StatusBadge tone={getStatusTone(prospect.status)}>{prospect.status}</StatusBadge>
          </div>

          <div className="detail-grid">
            <article className="detail-item"><span>Telefone</span><strong>{prospect.phone || '-'}</strong></article>
            <article className="detail-item"><span>E-mail</span><strong>{prospect.email || '-'}</strong></article>
            <article className="detail-item"><span>Origem</span><strong>{prospect.origin || '-'}</strong></article>
            <article className="detail-item"><span>Responsável</span><strong>{prospect.responsibleName || '-'}</strong></article>
            <article className="detail-item"><span>Prioridade</span><strong>{priorityLabel(prospect.priority)}</strong></article>
            <article className="detail-item"><span>Próxima ação</span><strong>{prospect.nextAction || '-'}</strong></article>
          </div>

          {audit.active ? (
            <p className={`prospect-audit${audit.critical ? ' is-critical' : ''}`}>
              Responsável com <strong>{audit.active}</strong> prazo(s) ativo(s)
              {audit.critical ? <> · <strong>{audit.critical}</strong> crítico(s)</> : null}
            </p>
          ) : null}

          {prospect.caseDescription ? (
            <div className="prospect-case-box">{prospect.caseDescription}</div>
          ) : null}
        </section>

        <section className="surface section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Conversão</h2>
              <p className="section-note">Transforme o prospect em cliente real</p>
            </div>
          </div>
          {isConverted ? (
            <p className="prospect-converted">
              Convertido. <Link to={`/clientes/${prospect.convertedClientId}`}>Ver cliente</Link>
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
                <button className="btn" type="submit">Confirmar conversão</button>
                <button className="btn btn-secondary" type="button" onClick={() => setShowConvert(false)}>Cancelar</button>
              </div>
            </form>
          ) : (
            <button className="btn" type="button" onClick={() => setShowConvert(true)}>Converter em cliente</button>
          )}
        </section>

        <section className="surface section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Interações</h2>
              <p className="section-note">{formatCount(interactions.length, 'interação', 'interações')}</p>
            </div>
          </div>

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
            <button className="btn" type="submit">Registrar</button>
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
            <p className="section-note">Nenhuma interação registrada.</p>
          )}
        </section>
      </div>
    </>
  );
}
