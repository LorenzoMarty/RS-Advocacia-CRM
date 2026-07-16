import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { FINANCE_CATEGORIES, FINANCE_TYPE_OPTIONS } from '../data';
import { PageChrome } from '../layout';
import { useAppState } from '../store';
import { Select } from '../components/select';
import { ComboField, Field, NotFoundState } from './common';
import { todayIso } from './financeiro-utils';

const lancamentoSchema = z.object({
  description: z.string().min(1, 'Informe a descrição.'),
  type: z.enum(['receita', 'despesa']),
  category: z.string().min(1, 'Selecione a categoria.'),
  value: z.string(),
  dueDate: z.string(),
  paymentDate: z.string(),
  clientId: z.string(),
  caseId: z.string(),
  notes: z.string(),
}).superRefine((data, ctx) => {
  if (data.value === '' || Number(data.value) < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'Informe um valor maior ou igual a zero.' });
  }
});

export function LancamentoFormPage() {
  const navigate = useNavigate();
  const params = useParams();
  const isEditing = Boolean(params.lancamentoId);
  const { lancamentos, clients, processes, saveLancamento } = useAppState();
  const lancamento = lancamentos.find((item) => item.id === params.lancamentoId) || null;
  // Status não é editado neste formulário (é mudado via ações "Pagar"/"Cancelar"
  // na listagem) — só precisa estar disponível para decidir se mostra o campo
  // de data de pagamento e para ser reenviado no payload sem alteração.
  const status = lancamento?.status || 'Pendente';

  const { register, handleSubmit, control, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(lancamentoSchema),
    defaultValues: {
      description: lancamento?.description || '',
      type: lancamento?.type || 'receita',
      category: lancamento?.category || '',
      value: lancamento?.value != null ? String(lancamento.value) : '',
      dueDate: lancamento?.dueDate || todayIso(),
      paymentDate: lancamento?.paymentDate || '',
      clientId: lancamento?.clientId || '',
      caseId: lancamento?.caseId || '',
      notes: lancamento?.notes || '',
    },
  });

  if (isEditing && !lancamento) {
    return <NotFoundState title="Lançamento não encontrado." />;
  }

  const watchedType = watch('type');
  const watchedClientId = watch('clientId');

  const categorySeed = watchedType === 'despesa' ? FINANCE_CATEGORIES.despesa : FINANCE_CATEGORIES.receita;
  const categories = [...new Set([
    ...categorySeed,
    ...lancamentos.filter((item) => item.type === watchedType).map((item) => item.category),
  ].filter(Boolean))];

  // Processos disponíveis dependem do cliente selecionado (sem cliente = todos).
  const availableCases = processes.filter(
    (process) => !watchedClientId || process.clientId === watchedClientId,
  );

  async function onSubmit(data) {
    const saved = await saveLancamento({
      id: lancamento?.id,
      ...data,
      status,
      description: data.description.trim(),
      value: Number(data.value),
      paymentDate: status === 'Pago' ? data.paymentDate : '',
    });
    if (!saved) return;
    navigate('/financeiro', { replace: true });
  }

  return (
    <>
      <PageChrome label={isEditing ? 'Editar lançamento' : 'Novo lançamento'} />
      <div className="lancamento-form-page">
        <section className="surface section-card">
          <div className="intro-grid">
            <Link className="intro-link" to="/financeiro">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Voltar para financeiro
            </Link>
            <h1 className="intro-title">{isEditing ? 'Editar lançamento' : 'Novo lançamento'}</h1>
          </div>

          <form className="lancamento-form" onSubmit={handleSubmit(onSubmit)}>
            <div className="form-grid">
              <Field id="lanc-description" label="Descrição" className="span-2" error={errors.description?.message} required>
                <input id="lanc-description" {...register('description')} />
              </Field>
              <Field id="lanc-type" label="Tipo">
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <Select
                      id="lanc-type"
                      {...field}
                      onChange={(event) => {
                        field.onChange(event.target.value);
                        setValue('category', '');
                      }}
                    >
                      {FINANCE_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </Select>
                  )}
                />
              </Field>
              <Field id="lanc-category" label="Categoria" error={errors.category?.message} required>
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <ComboField
                      id="lanc-category"
                      value={field.value}
                      options={categories}
                      selectPlaceholder="Selecione"
                      customLabel="+ Digitar nova categoria..."
                      customPlaceholder="Nome da categoria"
                      onChange={field.onChange}
                    />
                  )}
                />
              </Field>
              <Field id="lanc-value" label="Valor (R$)" error={errors.value?.message} required>
                <input id="lanc-value" type="number" min="0" step="0.01" {...register('value')} />
              </Field>
              <Field id="lanc-due" label="Vencimento">
                <input id="lanc-due" type="date" {...register('dueDate')} />
              </Field>
              {status === 'Pago' ? (
                <Field id="lanc-payment" label="Data de pagamento" error={errors.paymentDate?.message} required>
                  <input id="lanc-payment" type="date" {...register('paymentDate')} />
                </Field>
              ) : null}
              <Field id="lanc-client" label="Cliente (opcional)">
                <Controller
                  name="clientId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      id="lanc-client"
                      {...field}
                      onChange={(event) => {
                        const clientId = event.target.value;
                        const currentCaseId = watch('caseId');
                        const stillValid = processes.some(
                          (process) => process.id === currentCaseId && process.clientId === clientId,
                        );
                        field.onChange(clientId);
                        if (!stillValid) {
                          setValue('caseId', '');
                        }
                      }}
                    >
                      <option value="">Nenhum</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </Select>
                  )}
                />
              </Field>
              <Field id="lanc-case" label="Processo (opcional)">
                <Select id="lanc-case" {...register('caseId')}>
                  <option value="">
                    {watchedClientId && !availableCases.length ? 'Nenhum processo deste cliente' : 'Nenhum'}
                  </option>
                  {availableCases.map((process) => (
                    <option key={process.id} value={process.id}>{process.number}</option>
                  ))}
                </Select>
              </Field>
              <Field id="lanc-notes" label="Observações" className="span-2">
                <textarea id="lanc-notes" rows="3" {...register('notes')} />
              </Field>
            </div>

            <div className="form-actions">
              <button className="btn" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : isEditing ? 'Atualizar' : 'Salvar'}
              </button>
              <Link className="btn btn-secondary" to="/financeiro">Cancelar</Link>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
