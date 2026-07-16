import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { PROSPECT_ORIGIN_OPTIONS, PROSPECT_PRIORITY_OPTIONS } from '../data';
import { PageChrome } from '../layout';
import { useAppState } from '../store';
import { formatPhone, stripPhone } from '../utils';
import { Select } from '../components/select';
import { ComboField, Field, NotFoundState } from './common';
import { STATUS_LABELS, deadlineAuditFor, priorityLabel } from './prospeccao-utils';

const prospectSchema = z.object({
  name: z.string().min(1, 'Informe o nome.'),
  phone: z.string(),
  email: z.string(),
  origin: z.string(),
  responsibleId: z.string(),
  status: z.string(),
  priority: z.string(),
  notes: z.string(),
});

export function ProspectFormPage() {
  const navigate = useNavigate();
  const params = useParams();
  const isEditing = Boolean(params.prospectId);
  const { prospects, users, deadlines, saveProspect } = useAppState();
  const prospect = prospects.find((item) => item.id === params.prospectId) || null;

  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(prospectSchema),
    defaultValues: {
      name: prospect?.name || '',
      phone: prospect ? formatPhone(prospect.phone) : '',
      email: prospect?.email || '',
      origin: prospect?.origin || '',
      responsibleId: prospect?.responsibleId || '',
      status: prospect?.status || 'Novo',
      priority: prospect?.priority || 'Media',
      notes: prospect?.notes || '',
    },
  });

  if (isEditing && !prospect) {
    return <NotFoundState title="Prospect não encontrado." />;
  }

  const watchedResponsibleId = watch('responsibleId');
  const selectedUser = users.find((user) => user.id === watchedResponsibleId) || null;
  const audit = deadlineAuditFor(selectedUser?.name, deadlines);

  const originOptions = [...new Set([...PROSPECT_ORIGIN_OPTIONS, ...prospects.map((item) => item.origin).filter(Boolean)])];
  const statusOptions = [...new Set([...STATUS_LABELS, ...prospects.map((item) => item.status).filter(Boolean)])];

  async function onSubmit(data) {
    const saved = await saveProspect({
      id: prospect?.id,
      ...data,
      name: data.name.trim(),
      phone: stripPhone(data.phone),
      demandType: prospect?.demandType || '',
      caseDescription: prospect?.caseDescription || '',
      nextAction: prospect?.nextAction || '',
      lastContact: prospect?.lastContact || '',
      responsibleName: selectedUser?.name || prospect?.responsibleName || '',
    });
    if (!saved) return;
    navigate(`/prospeccao/${saved.id || prospect?.id}`, { replace: true });
  }

  return (
    <>
      <PageChrome label={isEditing ? 'Editar prospect' : 'Novo prospect'} />
      <div className="prospect-form-page">
        <section className="surface section-card">
          <div className="intro-grid">
            <Link className="intro-link" to="/prospeccao">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Voltar para prospecção
            </Link>
            <h1 className="intro-title">{isEditing ? 'Editar prospect' : 'Novo prospect'}</h1>
          </div>

          <form className="prospect-form" onSubmit={handleSubmit(onSubmit)}>
            <div className="form-grid">
              <Field id="prospect-name" label="Nome" className="span-2" error={errors.name?.message} required>
                <input id="prospect-name" {...register('name')} />
              </Field>
              <Field id="prospect-phone" label="Telefone">
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <input
                      id="prospect-phone"
                      {...field}
                      onChange={(event) => field.onChange(formatPhone(event.target.value))}
                    />
                  )}
                />
              </Field>
              <Field id="prospect-email" label="E-mail">
                <input id="prospect-email" type="email" {...register('email')} />
              </Field>
              <Field id="prospect-origin" label="Origem do contato">
                <Controller
                  name="origin"
                  control={control}
                  render={({ field }) => (
                    <ComboField
                      id="prospect-origin"
                      value={field.value}
                      options={originOptions}
                      selectPlaceholder="Selecione"
                      customLabel="+ Digitar nova origem..."
                      customPlaceholder="Ex: Evento, Parceria..."
                      onChange={field.onChange}
                    />
                  )}
                />
              </Field>
              <Field id="prospect-responsible" label="Responsável interno">
                <Select id="prospect-responsible" {...register('responsibleId')}>
                  <option value="">Selecione o responsável</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </Select>
              </Field>
              {watchedResponsibleId ? (
                <div className={`prospect-audit span-2${audit.critical ? ' is-critical' : ''}`}>
                  Responsável com <strong>{audit.active}</strong> prazo(s) ativo(s)
                  {audit.critical ? <> · <strong>{audit.critical}</strong> crítico(s)</> : null}
                </div>
              ) : null}
              <Field id="prospect-status" label="Status">
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <ComboField
                      id="prospect-status"
                      value={field.value}
                      options={statusOptions}
                      selectPlaceholder="Selecione o status"
                      customLabel="+ Digitar novo status..."
                      customPlaceholder="Nome do status"
                      onChange={field.onChange}
                    />
                  )}
                />
              </Field>
              <Field id="prospect-priority" label="Prioridade">
                <Select id="prospect-priority" {...register('priority')}>
                  {PROSPECT_PRIORITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>{priorityLabel(option)}</option>
                  ))}
                </Select>
              </Field>
              <Field id="prospect-notes" label="Observações" className="span-2">
                <textarea id="prospect-notes" rows="3" {...register('notes')} />
              </Field>
            </div>

            <div className="form-actions">
              <button className="btn" type="submit" disabled={isSubmitting}>{isEditing ? 'Atualizar' : 'Salvar'}</button>
              <Link className="btn btn-secondary" to="/prospeccao">Cancelar</Link>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
