import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, ExternalLink, File, Folder, FolderPlus, Pencil, Sparkles, Trash2, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <h2 className="font-serif text-lg text-foreground">Documentos</h2>
            <p className="text-xs text-muted-foreground">Google Drive</p>
          </div>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Indisponível no modo demo."
            copy="Documentos ficam disponíveis com a API e o Google Drive configurados."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div>
          <h2 className="font-serif text-lg text-foreground">Documentos</h2>
          <p className="text-xs text-muted-foreground">Pastas no Google Drive</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setOrganizing(true)} disabled={busy || loading}>
            <Sparkles className="size-4" />
            Organizar com IA
          </Button>
          {!creating ? (
            <Button variant="outline" size="sm" onClick={() => setCreating(true)} disabled={busy || loading}>
              <FolderPlus className="size-4" />
              Nova pasta
            </Button>
          ) : null}
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={busy || loading}>
            <Upload className="size-4" />
            Enviar arquivo
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => uploadFiles(event.target.files)}
          />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Navegação de pastas">
          {path.map((crumb, index) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <button
                type="button"
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-muted-foreground transition-colors hover:text-foreground',
                  index === path.length - 1 && 'font-medium text-foreground',
                )}
                onClick={() => goToCrumb(index)}
                disabled={index === path.length - 1}
              >
                {crumb.name}
              </button>
              {index < path.length - 1 ? (
                <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
              ) : null}
            </span>
          ))}
        </nav>

        {creating ? (
          <form className="flex flex-wrap items-center gap-2" onSubmit={handleCreateFolder}>
            <Input
              type="text"
              className="max-w-xs"
              placeholder="Nome da pasta"
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              disabled={busy}
              autoFocus
            />
            <Button type="submit" size="sm" disabled={!folderName.trim() || busy}>
              {busy ? 'Criando…' : 'Criar'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCreating(false);
                setFolderName('');
              }}
              disabled={busy}
            >
              Cancelar
            </Button>
          </form>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : (
          <div
            className={cn(
              'rounded-xl border border-dashed border-border p-3 transition-colors',
              dragOver && 'border-primary bg-primary/5',
            )}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {folders.length ? (
              <div className="flex flex-col gap-2">
                {folders.map((folder) => (
                  <article
                    key={folder.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-accent/5 px-3.5 py-3"
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      onClick={() => enterFolder(folder)}
                    >
                      <Folder className="size-5 shrink-0 text-primary" aria-hidden="true" />
                      <span className="truncate text-sm font-medium text-foreground">{folder.name}</span>
                    </button>
                    <div className="flex shrink-0 gap-1.5">
                      {folder.managed ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-8"
                          aria-label="Renomear pasta"
                          onClick={() => handleRenameFolder(folder)}
                          disabled={busy}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label="Excluir pasta"
                        onClick={() => handleDeleteFolder(folder)}
                        disabled={busy}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            {files.length ? (
              <div className={cn('flex flex-col gap-2', folders.length && 'mt-2')}>
                {files.map((file) => (
                  <article
                    key={file.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-accent/5 px-3.5 py-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <File className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-medium text-foreground">{file.name}</h4>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatSize(file.size)}
                          {file.updatedAt ? ` · ${formatDateTime(file.updatedAt)}` : ''}
                        </p>
                      </div>
                    </div>
                    {file.link ? (
                      <Button asChild variant="outline" size="sm" className="shrink-0">
                        <a href={file.link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="size-4" />
                          Abrir no Drive
                        </a>
                      </Button>
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
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Arraste arquivos para esta pasta para enviá-los.
              </p>
            )}
          </div>
        )}
      </CardContent>

      {organizing ? (
        <ClientDriveOrganize
          clientId={client.id}
          onClose={() => setOrganizing(false)}
          onApplied={() => load(currentFolderId, path)}
        />
      ) : null}
    </Card>
  );
}
