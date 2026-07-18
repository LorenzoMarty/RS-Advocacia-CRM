import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
      status: prospect?.status || 'Em contato',
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
      <div className="grid gap-4">
        <section className="mb-2">
          <Link
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            to="/prospeccao"
          >
            <ArrowLeft className="size-3.5" />
            Voltar para prospecção
          </Link>

          <p className="mt-3 font-serif text-3xl text-foreground">
            {isEditing ? 'Editar prospect' : 'Novo prospect'}
          </p>
        </section>

        <Card>
          <CardContent className="py-5">
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
                      type="tel"
                      autoComplete="tel"
                      {...field}
                      onChange={(event) => field.onChange(formatPhone(event.target.value))}
                    />
                  )}
                />
              </Field>
              <Field id="prospect-email" label="E-mail">
                <input id="prospect-email" type="email" autoComplete="email" {...register('email')} />
              </Field>
              <Field id="prospect-origin" label="Origem do contato">
                <Controller
                  name="origin"
                  control={control}
                  render={({ field }) => (
                    <ComboField
                      id="prospect-origin"
                      campo="prospect_origem"
                      value={field.value}
                      options={originOptions}
                      selectPlaceholder="Selecione"
                      customLabel="+ Digitar nova origem…"
                      customPlaceholder="Ex: Evento, Parceria…"
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
                <Select id="prospect-status" {...register('status')}>
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Select>
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
              <Button type="submit" disabled={isSubmitting}>{isEditing ? 'Atualizar' : 'Salvar'}</Button>
              <Button asChild variant="outline">
                <Link to="/prospeccao">Cancelar</Link>
              </Button>
            </div>
          </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
