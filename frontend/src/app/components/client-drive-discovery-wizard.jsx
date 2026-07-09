import { useState } from 'react';
import { useAppState } from '../store';
import { discoverNewClients, confirmNewClients } from '../services/documentos.js';

export function ClientDriveDiscoveryWizard({ onClose }) {
  const { addFlash, refreshClients } = useAppState();
  const [step, setStep] = useState('scan');
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState([]);

  async function handleScan() {
    setLoading(true);
    try {
      const found = await discoverNewClients();
      setCandidates(found.map((item) => ({ ...item, included: true })));
      setStep('review');
    } catch (error) {
      addFlash(error.message || 'Não foi possível escanear a pasta "Clientes" do Drive.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function updateCandidate(index, changes) {
    setCandidates((current) =>
      current.map((item, i) => (i === index ? { ...item, ...changes } : item))
    );
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      const selected = candidates.filter((item) => item.included);
      const resultado = await confirmNewClients(selected);
      addFlash(`${resultado.clientsCreated} cliente(s) importado(s) do Drive.`, 'success');
      await refreshClients();
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
          <h3>Importar clientes existentes do Google Drive</h3>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>

        {step === 'scan' && (
          <div className="import-wizard-body">
            <p className="import-wizard-hint">
              O sistema vai listar as pastas de nível 1 dentro de "Clientes" no Drive que ainda
              não têm cliente cadastrado no CRM. Nada é gravado até você revisar e confirmar.
              Cada cliente aprovado tem seus processos (subpastas) detectados automaticamente.
            </p>
            <button
              type="button"
              className="btn"
              onClick={handleScan}
              disabled={loading}
            >
              {loading ? 'Escaneando...' : 'Escanear pasta "Clientes"'}
            </button>
          </div>
        )}

        {step === 'review' && (
          <div className="import-wizard-body">
            <section className="import-wizard-section">
              <h4>Clientes encontrados ({candidates.length})</h4>
              {candidates.length === 0 && (
                <p className="import-wizard-hint">
                  Nenhuma pasta nova encontrada — todas já estão vinculadas a um cliente.
                </p>
              )}
              {candidates.map((item, index) => (
                <div className="import-wizard-row" key={item.folderId}>
                  <input
                    type="checkbox"
                    checked={item.included}
                    onChange={(event) =>
                      updateCandidate(index, { included: event.target.checked })
                    }
                  />
                  <div className="import-wizard-row-copy">
                    <strong>{item.name}</strong>
                  </div>
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
                disabled={loading || candidates.filter((item) => item.included).length === 0}
              >
                {loading ? 'Confirmando...' : 'Confirmar importação'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
