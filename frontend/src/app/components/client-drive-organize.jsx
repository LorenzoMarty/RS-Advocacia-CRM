import { useState } from 'react';
import { useAppState } from '../store';
import { applyDriveOrganization, suggestDriveOrganization } from '../services/documentos';

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

  async function handleSuggest() {
    setLoading(true);
    try {
      const resultado = await suggestDriveOrganization(clientId);
      setOperations(resultado.operations.map((item) => ({ ...item, included: true })));
      setDiscarded(resultado.discarded);
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

  async function handleApply() {
    const selected = operations.filter((item) => item.included);
    if (!selected.length) {
      addFlash('Selecione ao menos uma operação para aplicar.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const resultado = await applyDriveOrganization(clientId, selected);
      const partes = [`${resultado.applied} operação(ões) aplicada(s)`];
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
              A IA vai analisar os nomes de pastas e arquivos do cliente no Drive e
              propor movimentações para a estrutura padrão (Petições, Documentos,
              Outros e uma pasta por processo). Nada é alterado até você revisar e
              aplicar.
            </p>
            <button type="button" className="btn" onClick={handleSuggest} disabled={loading}>
              {loading ? 'Gerando plano...' : 'Gerar plano de organização'}
            </button>
          </div>
        )}

        {step === 'review' && (
          <div className="import-wizard-body">
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
                disabled={loading || operations.every((item) => !item.included)}
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
