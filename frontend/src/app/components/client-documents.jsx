import { useEffect, useRef, useState } from 'react';

import { isApiEnabled } from '../api';
import { useAppState } from '../store';
import {
  DOCUMENT_CATEGORIES,
  listClientDocuments,
  uploadClientDocument,
} from '../services/documentos';
import { EmptyState } from '../pages/common';

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR');
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

export function ClientDocuments({ client }) {
  const { addFlash } = useAppState();
  const inputRef = useRef(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState(DOCUMENT_CATEGORIES[1].value);
  const [file, setFile] = useState(null);

  function closeAdd() {
    setAdding(false);
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  useEffect(() => {
    if (!isApiEnabled) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError('');
    listClientDocuments(client.id)
      .then((items) => {
        if (active) setDocuments(items);
      })
      .catch((err) => {
        if (active) setError(errorText(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [client.id]);

  async function handleUpload(event) {
    event.preventDefault();
    if (!file || uploading) return;

    setUploading(true);
    try {
      const saved = await uploadClientDocument(client.id, { file, category });
      setDocuments((current) => [saved, ...current.filter((doc) => doc.id !== saved.id)]);
      closeAdd();
      addFlash('Documento enviado ao Google Drive.', 'success');
    } catch (err) {
      addFlash(errorText(err), 'error');
    } finally {
      setUploading(false);
    }
  }

  if (!isApiEnabled) {
    return (
      <section className="surface section-card client-documents">
        <div className="section-head">
          <div>
            <h2 className="section-title">Documentos</h2>
            <p className="section-note">Google Drive</p>
          </div>
        </div>
        <div className="empty">
          <strong>Indisponível no modo demo.</strong>
          <p>Documentos ficam disponíveis com a API e o Google Drive configurados.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="surface section-card client-documents">
      <div className="section-head">
        <div>
          <h2 className="section-title">Documentos</h2>
          <p className="section-note">Arquivos no Google Drive</p>
        </div>
        {!adding ? (
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            Adicionar documento
          </button>
        ) : null}
      </div>

      {adding ? (
        <form className="document-upload" onSubmit={handleUpload}>
          <select
            className="document-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            disabled={uploading}
            aria-label="Categoria do documento"
          >
            {DOCUMENT_CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input
            ref={inputRef}
            type="file"
            className="document-file"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            disabled={uploading}
          />
          <button type="submit" className="btn" disabled={!file || uploading}>
            {uploading ? 'Enviando…' : 'Enviar'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={closeAdd}
            disabled={uploading}
          >
            Cancelar
          </button>
        </form>
      ) : null}

      {error ? <p className="document-error">{error}</p> : null}

      {loading ? (
        <p className="document-loading">Carregando documentos…</p>
      ) : (
        <div className="document-groups">
          {DOCUMENT_CATEGORIES.map((group) => {
            const items = documents.filter((doc) => doc.category === group.value);
            return (
              <div key={group.value} className="document-group">
                <h3 className="document-group-title">{group.label}</h3>
                {items.length ? (
                  <div className="list">
                    {items.map((doc) => (
                      <article key={doc.id} className="document-item">
                        <div className="document-meta">
                          <h4 className="list-title">{doc.name}</h4>
                          <p className="list-subtitle">
                            {formatSize(doc.size)}
                            {doc.updatedAt ? ` · ${formatDateTime(doc.updatedAt)}` : ''}
                          </p>
                        </div>
                        {doc.link ? (
                          <a
                            className="btn btn-secondary"
                            href={doc.link}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Abrir no Drive
                          </a>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Sem arquivos." copy="Envie um documento nesta categoria." />
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
