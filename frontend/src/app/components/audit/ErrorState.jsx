import { EmptyState } from '../../pages/common';

// Estado de erro quando os dados não puderam ser carregados.
export function ErrorState({ onRetry }) {
  return (
    <EmptyState
      title="Não foi possível carregar a auditoria."
      copy="Verifique a conexão com o servidor e tente novamente."
      actions={onRetry ? (
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Tentar novamente
        </button>
      ) : null}
    />
  );
}
