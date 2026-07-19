import { useCallback, useEffect, useRef, useState } from 'react';

import { isApiEnabled } from '../api';
import { useAppState } from '../store';
import {
  createDriveFolder,
  deleteDriveFolder,
  listClientDrive,
  renameDriveFolder,
  uploadToDriveFolder,
} from '../services/documentos';
import { EmptyState } from '../pages/common';
import { ClientDriveOrganize } from './client-drive-organize';

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
  // path: trail of { id, name } from the client root to the current folder.
  const [path, setPath] = useState([]);
  const [rootId, setRootId] = useState('');
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const currentFolderId = path.length ? path[path.length - 1].id : rootId;

  const load = useCallback(
    async (folderId, trail) => {
      setLoading(true);
      setError('');
      try {
        const data = await listClientDrive(client.id, folderId);
        setRootId(data.rootId);
        setFolders(data.folders);
        setFiles(data.files);
        if (trail) {
          setPath(trail);
        } else if (!folderId) {
          setPath([{ id: data.folderId, name: 'Início' }]);
        }
      } catch (err) {
        setError(errorText(err));
      } finally {
        setLoading(false);
      }
    },
    [client.id],
  );

  useEffect(() => {
    if (!isApiEnabled) {
      setLoading(false);
      return;
    }
    setPath([]);
    load(undefined);
  }, [client.id, load]);

  function enterFolder(folder) {
    load(folder.id, [...path, { id: folder.id, name: folder.name }]);
  }

  function goToCrumb(index) {
    const trail = path.slice(0, index + 1);
    load(trail[trail.length - 1].id, trail);
  }

  async function handleCreateFolder(event) {
    event.preventDefault();
    const name = folderName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await createDriveFolder(client.id, { name, parentId: currentFolderId });
      setFolderName('');
      setCreating(false);
      await load(currentFolderId, path);
      addFlash('Pasta criada no Google Drive.', 'success');
    } catch (err) {
      addFlash(errorText(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleRenameFolder(folder) {
    if (busy) return;
    // Managed folders carry a "<n>. " prefix; let the user edit only the label.
    const atual = folder.name.replace(/^\d+\.\s*/, '');
    const novo = window.prompt('Novo nome da pasta:', atual);
    if (novo === null) return;
    const name = novo.trim();
    if (!name || name === atual) return;
    setBusy(true);
    try {
      await renameDriveFolder(client.id, { folderId: folder.id, name });
      await load(currentFolderId, path);
      addFlash('Pasta renomeada no Google Drive.', 'success');
    } catch (err) {
      addFlash(errorText(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteFolder(folder) {
    if (busy) return;
    const ok = window.confirm(
      `Excluir a pasta "${folder.name}" e todo o seu conteúdo? Esta ação não pode ser desfeita.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deleteDriveFolder(client.id, folder.id);
      await load(currentFolderId, path);
      addFlash('Pasta excluída do Google Drive.', 'success');
    } catch (err) {
      addFlash(errorText(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  const uploadFiles = useCallback(
    async (fileList) => {
      const selected = Array.from(fileList || []);
      if (!selected.length || busy) return;
      setBusy(true);
      try {
        for (const file of selected) {
          // Sequential: keeps Drive rate use modest and error messages clear.
          await uploadToDriveFolder(client.id, { file, folderId: currentFolderId });
        }
        await load(currentFolderId, path);
        addFlash(
          selected.length > 1 ? 'Arquivos enviados ao Google Drive.' : 'Arquivo enviado ao Google Drive.',
          'success',
        );
      } catch (err) {
        addFlash(errorText(err), 'error');
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [busy, client.id, currentFolderId, path, load, addFlash],
  );

  function handleDrop(event) {
    event.preventDefault();
    setDragOver(false);
    uploadFiles(event.dataTransfer?.files);
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
          <p className="section-note">Pastas no Google Drive</p>
        </div>
        <div className="drive-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setOrganizing(true)}
            disabled={busy || loading}
          >
            Organizar com IA
          </button>
          {!creating ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCreating(true)}
              disabled={busy || loading}
            >
              Nova pasta
            </button>
          ) : null}
          <button
            type="button"
            className="btn"
            onClick={() => inputRef.current?.click()}
            disabled={busy || loading}
          >
            Enviar arquivo
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => uploadFiles(event.target.files)}
          />
        </div>
      </div>

      <nav className="drive-breadcrumb" aria-label="Navegação de pastas">
        {path.map((crumb, index) => (
          <span key={crumb.id} className="drive-crumb">
            <button
              type="button"
              className="drive-crumb-link"
              onClick={() => goToCrumb(index)}
              disabled={index === path.length - 1}
            >
              {crumb.name}
            </button>
            {index < path.length - 1 ? <span className="drive-crumb-sep">/</span> : null}
          </span>
        ))}
      </nav>

      {creating ? (
        <form className="document-upload" onSubmit={handleCreateFolder}>
          <input
            type="text"
            className="document-file"
            placeholder="Nome da pasta"
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            disabled={busy}
            autoFocus
          />
          <button type="submit" className="btn" disabled={!folderName.trim() || busy}>
            {busy ? 'Criando…' : 'Criar'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setCreating(false);
              setFolderName('');
            }}
            disabled={busy}
          >
            Cancelar
          </button>
        </form>
      ) : null}

      {error ? <p className="document-error">{error}</p> : null}

      {loading ? (
        <p className="document-loading">Carregando…</p>
      ) : (
        <div
          className={`drive-dropzone${dragOver ? ' is-dragover' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {folders.length ? (
            <div className="list drive-folder-list">
              {folders.map((folder) => (
                <article key={folder.id} className="document-item folder-item">
                  <button
                    type="button"
                    className="folder-open"
                    onClick={() => enterFolder(folder)}
                  >
                    <span className="folder-icon" aria-hidden="true">📁</span>
                    <span className="list-title">{folder.name}</span>
                  </button>
                  <div className="folder-actions">
                    {folder.managed ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleRenameFolder(folder)}
                        disabled={busy}
                      >
                        Renomear
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleDeleteFolder(folder)}
                      disabled={busy}
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {files.length ? (
            <div className="list drive-file-list">
              {files.map((file) => (
                <article key={file.id} className="document-item">
                  <div className="document-meta">
                    <h4 className="list-title">{file.name}</h4>
                    <p className="list-subtitle">
                      {formatSize(file.size)}
                      {file.updatedAt ? ` · ${formatDateTime(file.updatedAt)}` : ''}
                    </p>
                  </div>
                  {file.link ? (
                    <a
                      className="btn btn-secondary"
                      href={file.link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Abrir no Drive
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}

          {!folders.length && !files.length ? (
            <EmptyState
              title="Pasta vazia."
              copy="Arraste arquivos aqui ou use “Enviar arquivo” e “Nova pasta”."
            />
          ) : (
            <p className="drive-drophint">Arraste arquivos para esta pasta para enviá-los.</p>
          )}
        </div>
      )}

      {organizing ? (
        <ClientDriveOrganize
          clientId={client.id}
          onClose={() => setOrganizing(false)}
          onApplied={() => load(currentFolderId, path)}
        />
      ) : null}
    </section>
  );
}
