import { useEffect, useState } from 'react';
import { useAppState } from '../store';
import { scanClientDriveImport, confirmClientDriveImport } from '../services/documentos.js';

const CATEGORY_LABELS = {
  petition: 'Petição/Processo',
  document: 'Documento pessoal',
  other: 'Indefinido',
};

function formatBytes(size) {
  if (!size) return '';
  const kb = size / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function hasValidCnjShape(value) {
  return value.replace(/\D/g, '').length === 20;
}

export function ClientImportWizard({ clientId, onClose, onImported }) {
  const { addFlash, refreshProcesses } = useAppState();
  const [step, setStep] = useState('scan');
  const [useAi, setUseAi] = useState(false);
  const [aiNotice, setAiNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [processes, setProcesses] = useState([]);
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  const [warnings, setWarnings] = useState([]);

  async function handleScan() {
    setLoading(true);
    try {
      const resultado = await scanClientDriveImport(clientId, '', { useAi });
      setProcesses(
        resultado.suggestedProcesses.map((item) => ({ ...item, included: true }))
      );
      setDocuments(
        resultado.suggestedDocuments.map((item) => ({ ...item, included: true }))
      );
      setWarnings(
        (resultado.warningsWithoutNumber || []).map((item) => ({
          ...item,
          numeroProcesso: '',
          included: false,
        }))
      );
      setAiNotice(resultado.ai?.notice || '');
      setStep('review');
    } catch (error) {
      addFlash(error.message || 'Não foi possível escanear a pasta do Drive.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function updateWarning(index, changes) {
    setWarnings((current) =>
      current.map((item, i) => (i === index ? { ...item, ...changes } : item))
    );
  }

  function updateProcess(index, changes) {
    setProcesses((current) =>
      current.map((item, i) => (i === index ? { ...item, ...changes } : item))
    );
  }

  function updateDocument(index, changes) {
    setDocuments((current) =>
      current.map((item, i) => (i === index ? { ...item, ...changes } : item))
    );
  }

  const includedProcessNumbers = processes
    .filter((item) => item.included)
    .map((item) => item.numeroProcesso);

  async function handleConfirm() {
    setLoading(true);
    try {
      const warningProcesses = warnings
        .filter((item) => item.included && hasValidCnjShape(item.numeroProcesso))
        .map((item) => ({
          numeroProcesso: item.numeroProcesso.trim(),
          originFolderId: item.originFolderId,
          legalArea: item.legalArea,
          description: item.description,
        }));
      const resultado = await confirmClientDriveImport(clientId, {
        processes: [...processes.filter((item) => item.included), ...warningProcesses],
        documents: documents
          .filter((item) => item.included)
          .map((item) => ({
            ...item,
            processNumber: includedProcessNumbers.includes(item.processNumber)
              ? item.processNumber
              : '',
          })),
      });
      addFlash(
        `Importação concluída: ${resultado.processesCreated} processo(s), ${resultado.documentsCreated} documento(s).`,
        'success'
      );
      await refreshProcesses();
      onImported?.();
      onClose();
    } catch (error) {
      addFlash(error.message || 'Não foi possível confirmar a importação.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="popup-layer" role="dialog" aria-modal="true">
      <div className="popup-panel popup-panel-wide">
        <div className="import-wizard-header">
          <h3>Importar pasta existente do Google Drive</h3>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>

        {step === 'scan' && (
          <div className="import-wizard-body">
            <p className="import-wizard-hint">
              O sistema vai escanear a pasta do cliente no Drive e sugerir, por CNJ e
              palavras-chave, quais arquivos parecem processos e quais parecem
              documentos pessoais. Nada é gravado até você revisar e confirmar.
            </p>
            <label className="import-wizard-field import-wizard-checkbox">
              <input
                type="checkbox"
                checked={useAi}
                onChange={(event) => setUseAi(event.target.checked)}
              />
              <span>
                Analisar com IA (usa apenas os nomes de pastas e arquivos; sugere área,
                descrição e possíveis processos sem número)
              </span>
            </label>
            <button
              type="button"
              className="btn"
              onClick={handleScan}
              disabled={loading}
            >
              {loading ? 'Escaneando…' : 'Escanear pasta'}
            </button>
          </div>
        )}

        {step === 'review' && (
          <div className="import-wizard-body">
            {aiNotice && <p className="import-wizard-hint">{aiNotice}</p>}
            <section className="import-wizard-section">
              <h4>Processos sugeridos ({processes.length})</h4>
              {processes.length === 0 && (
                <p className="import-wizard-hint">Nenhum número CNJ encontrado.</p>
              )}
              {processes.map((item, index) => (
                <div className="import-wizard-row" key={item.numeroProcesso}>
                  <input
                    type="checkbox"
                    checked={item.included}
                    onChange={(event) =>
                      updateProcess(index, { included: event.target.checked })
                    }
                  />
                  <div className="import-wizard-row-copy">
                    <strong>{item.numeroProcesso}</strong>
                    <span>
                      {item.originFolderName}
                      {item.needsHabilitacao && ' · advogado não habilitado'}
                    </span>
                  </div>
                </div>
              ))}
            </section>

            {warnings.length > 0 && (
              <section className="import-wizard-section">
                <h4>Possíveis processos sem número (IA) ({warnings.length})</h4>
                <p className="import-wizard-hint">
                  A IA identificou pastas que parecem processos, mas sem número CNJ no
                  nome. Digite o número para incluir na importação.
                </p>
                {warnings.map((item, index) => (
                  <div className="import-wizard-row" key={`${item.title}-${index}`}>
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
                        {[item.legalArea, item.originFolderName]
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
              <h4>Documentos sugeridos ({documents.length})</h4>
              {documents.map((item, index) => (
                <div className="import-wizard-row" key={item.driveFileId}>
                  <input
                    type="checkbox"
                    checked={item.included}
                    onChange={(event) =>
                      updateDocument(index, { included: event.target.checked })
                    }
                  />
                  <div className="import-wizard-row-copy">
                    <strong>{item.name}</strong>
                    <span>{formatBytes(item.size)}</span>
                  </div>
                  <select
                    className="import-wizard-input"
                    value={item.category}
                    onChange={(event) =>
                      updateDocument(index, { category: event.target.value })
                    }
                  >
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="import-wizard-input"
                    value={item.processNumber}
                    onChange={(event) =>
                      updateDocument(index, { processNumber: event.target.value })
                    }
                  >
                    <option value="">Sem processo vinculado</option>
                    {processes
                      .filter((processo) => processo.included)
                      .map((processo) => (
                        <option key={processo.numeroProcesso} value={processo.numeroProcesso}>
                          {processo.numeroProcesso}
                        </option>
                      ))}
                  </select>
                </div>
              ))}
            </section>

            <div className="import-wizard-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep('scan')}
                disabled={loading}
              >
                Escanear novamente
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleConfirm}
                disabled={loading}
              >
                {loading ? 'Confirmando…' : 'Confirmar importação'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
