import { useState } from 'react';
import { useAppState } from '../store';
import { applyDriveOrganization, suggestDriveOrganization } from '../services/documentos';

function hasValidCnjShape(value) {
  return value.replace(/\D/g, '').length === 20;
}

function operationLabel(item) {
  if (item.type === 'create_folder') {
    return `Criar pasta "${item.name}"`;
  }
  if (item.type === 'rename') {
    return `Renomear para "${item.newName}"`;
  }
  return 'Mover para outra pasta';
}

export function ClientDriveOrganize({ clientId, onClose, onApplied }) {
  const { addFlash } = useAppState();
  const [step, setStep] = useState('start');
  const [loading, setLoading] = useState(false);
  const [operations, setOperations] = useState([]);
  const [discarded, setDiscarded] = useState(0);
  const [processes, setProcesses] = useState([]);
  const [warnings, setWarnings] = useState([]);

  async function handleSuggest() {
    setLoading(true);
    try {
      const resultado = await suggestDriveOrganization(clientId);
      setOperations(resultado.operations.map((item) => ({ ...item, included: true })));
      setDiscarded(resultado.discarded);
      setProcesses(resultado.processesSuggested.map((item) => ({ ...item, included: true })));
      setWarnings(
        resultado.processWarnings.map((item) => ({
          ...item,
          numeroProcesso: hasValidCnjShape(item.partialNumber) ? item.partialNumber : '',
          included: hasValidCnjShape(item.partialNumber),
        }))
      );
      setStep('review');
    } catch (error) {
      addFlash(
        error.message || 'Não foi possível gerar o plano de organização.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }

  function updateOperation(index, changes) {
    setOperations((current) =>
      current.map((item, i) => (i === index ? { ...item, ...changes } : item))
    );
  }

  function updateProcess(index, changes) {
    setProcesses((current) =>
      current.map((item, i) => (i === index ? { ...item, ...changes } : item))
    );
  }

  function updateWarning(index, changes) {
    setWarnings((current) =>
      current.map((item, i) => (i === index ? { ...item, ...changes } : item))
    );
  }

  async function handleApply() {
    const selectedOperations = operations.filter((item) => item.included);
    const confirmedWarnings = warnings
      .filter((item) => item.included && hasValidCnjShape(item.numeroProcesso))
      .map((item) => ({
        numeroProcesso: item.numeroProcesso.trim(),
        originFolderId: item.originFolderId,
        legalArea: '',
        description: item.title,
      }));
    const selectedProcesses = [
      ...processes.filter((item) => item.included),
      ...confirmedWarnings,
    ];
    if (!selectedOperations.length && !selectedProcesses.length) {
      addFlash('Selecione ao menos um item para aplicar.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const resultado = await applyDriveOrganization(
        clientId,
        selectedOperations,
        selectedProcesses
      );
      const partes = [`${resultado.applied} operação(ões) aplicada(s)`];
      if (resultado.processesCreated) {
        partes.push(`${resultado.processesCreated} processo(s) criado(s)`);
      }
      if (resultado.failures.length) {
        partes.push(`${resultado.failures.length} falha(s)`);
      }
      if (resultado.rejected.length) {
        partes.push(`${resultado.rejected.length} rejeitada(s)`);
      }
      addFlash(partes.join(', ') + '.', resultado.failures.length ? 'warning' : 'success');
      onApplied?.();
      onClose();
    } catch (error) {
      addFlash(error.message || 'Não foi possível aplicar a organização.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="popup-layer" role="dialog" aria-modal="true">
      <div className="popup-panel popup-panel-wide">
        <div className="import-wizard-header">
          <h3>Organizar pasta com IA</h3>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>

        {step === 'start' && (
          <div className="import-wizard-body">
            <p className="import-wizard-hint">
              A IA vai analisar os nomes de pastas e arquivos do cliente no Drive,
              identificar processos ainda não cadastrados e propor movimentações
              para a estrutura padrão (Petições, Documentos, Outros e uma pasta por
              processo). Nada é alterado até você revisar e aplicar.
            </p>
            <button type="button" className="btn" onClick={handleSuggest} disabled={loading}>
              {loading ? 'Gerando plano...' : 'Gerar plano de organização'}
            </button>
          </div>
        )}

        {step === 'review' && (
          <div className="import-wizard-body">
            <section className="import-wizard-section">
              <h4>Processos identificados ({processes.length})</h4>
              {processes.length === 0 && (
                <p className="import-wizard-hint">
                  Nenhuma pasta com número de processo ainda não cadastrado foi
                  encontrada.
                </p>
              )}
              {processes.map((item, index) => (
                <div className="import-wizard-row" key={`processo-${item.numeroProcesso}`}>
                  <input
                    type="checkbox"
                    checked={item.included}
                    onChange={(event) =>
                      updateProcess(index, { included: event.target.checked })
                    }
                  />
                  <div className="import-wizard-row-copy">
                    <strong>Criar processo "{item.numeroProcesso}"</strong>
                    <span>Origem: pasta "{item.originFolderName}"</span>
                  </div>
                </div>
              ))}
            </section>

            {warnings.length > 0 && (
              <section className="import-wizard-section">
                <h4>Possíveis processos com número incompleto ({warnings.length})</h4>
                <p className="import-wizard-hint">
                  A IA encontrou pastas que parecem processo, mas o número não está
                  completo/válido no nome. Digite o número correto para incluir.
                </p>
                {warnings.map((item, index) => (
                  <div className="import-wizard-row" key={`aviso-${item.originFolderId}`}>
                    <input
                      type="checkbox"
                      checked={item.included}
                      disabled={!hasValidCnjShape(item.numeroProcesso)}
                      onChange={(event) =>
                        updateWarning(index, { included: event.target.checked })
                      }
                    />
                    <div className="import-wizard-row-copy">
                      <strong>{item.title}</strong>
                      <span>
                        {[item.reason, `pasta "${item.originFolderName}"`]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                    <input
                      type="text"
                      className="import-wizard-input"
                      value={item.numeroProcesso}
                      placeholder="0000000-00.0000.0.00.0000"
                      onChange={(event) =>
                        updateWarning(index, {
                          numeroProcesso: event.target.value,
                          included: hasValidCnjShape(event.target.value),
                        })
                      }
                    />
                  </div>
                ))}
              </section>
            )}

            <section className="import-wizard-section">
              <h4>Operações sugeridas ({operations.length})</h4>
              {discarded > 0 && (
                <p className="import-wizard-hint">
                  {discarded} sugestão(ões) inválida(s) da IA foram descartadas
                  automaticamente.
                </p>
              )}
              {operations.length === 0 && (
                <p className="import-wizard-hint">
                  A pasta já parece organizada — nenhuma operação sugerida.
                </p>
              )}
              {operations.map((item, index) => (
                <div className="import-wizard-row" key={`${item.type}-${index}`}>
                  <input
                    type="checkbox"
                    checked={item.included}
                    onChange={(event) =>
                      updateOperation(index, { included: event.target.checked })
                    }
                  />
                  <div className="import-wizard-row-copy">
                    <strong>{operationLabel(item)}</strong>
                    <span>{item.reason}</span>
                  </div>
                </div>
              ))}
            </section>

            <div className="import-wizard-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSuggest}
                disabled={loading}
              >
                Gerar novamente
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleApply}
                disabled={
                  loading ||
                  (operations.every((item) => !item.included) &&
                    processes.every((item) => !item.included) &&
                    warnings.every((item) => !item.included))
                }
              >
                {loading ? 'Aplicando...' : 'Aplicar selecionadas'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
