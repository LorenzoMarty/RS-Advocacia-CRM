from collections.abc import Iterable

from auditoria.models import RegistroAuditoria
from core.utils import isoformat_ou_nulo
from peticoes.models import Peticao
from prazos.models import Prazo

# (entidade_tipo, entidade_id) -> (processo_id, numero_processo)
_ProcessosPorEntidade = dict[tuple[str, str], tuple[str, str]]

_TIPOS_COM_PROCESSO_INDIRETO = {
    RegistroAuditoria.ENTIDADE_PRAZO: Prazo,
    RegistroAuditoria.ENTIDADE_PETICAO: Peticao,
}


def _precisa_resolver_processo(registro: RegistroAuditoria) -> bool:
    return (
        not registro.processo_id
        and registro.entidade_tipo in _TIPOS_COM_PROCESSO_INDIRETO
        and str(registro.entidade_id).isdigit()
    )


def _processos_por_entidade(
    registros: Iterable[RegistroAuditoria],
) -> _ProcessosPorEntidade:
    """Resolve the processo of prazo/peticao records in one query per entity type."""
    ids_por_tipo: dict[str, set[str]] = {}
    for registro in registros:
        if _precisa_resolver_processo(registro):
            ids_por_tipo.setdefault(registro.entidade_tipo, set()).add(
                str(registro.entidade_id)
            )

    resolvido: _ProcessosPorEntidade = {}
    for tipo, ids in ids_por_tipo.items():
        modelo = _TIPOS_COM_PROCESSO_INDIRETO[tipo]
        for entidade in modelo.objects.filter(pk__in=ids).select_related("processo"):
            if entidade.processo_id:
                resolvido[(tipo, str(entidade.pk))] = (
                    str(entidade.processo_id),
                    entidade.processo.numero_processo,
                )
    return resolvido


def serialize_registro(
    registro: RegistroAuditoria,
    processos: _ProcessosPorEntidade | None = None,
):
    """Serialize one audit record.

    Pass ``processos`` (from :func:`_processos_por_entidade`) when serializing
    many records; without it the processo of a prazo/peticao is looked up here.
    """
    processo_id = registro.processo_id or ""
    processo_rotulo = registro.processo_rotulo or ""

    if not processo_id:
        if registro.entidade_tipo == RegistroAuditoria.ENTIDADE_PROCESSO:
            processo_id = registro.entidade_id
            processo_rotulo = registro.entidade_rotulo
        elif _precisa_resolver_processo(registro):
            if processos is None:
                processos = _processos_por_entidade([registro])
            achado = processos.get((registro.entidade_tipo, str(registro.entidade_id)))
            if achado:
                processo_id, processo_rotulo = achado

    return {
        "id": str(registro.pk),
        "pk": registro.pk,
        "acao": registro.acao,
        "entidade_tipo": registro.entidade_tipo,
        "entidade_id": registro.entidade_id,
        "entidade_rotulo": registro.entidade_rotulo,
        "autor_nome": registro.autor_nome,
        "resumo": registro.resumo,
        "alteracoes": registro.alteracoes,
        "processo_id": processo_id,
        "processo_numero": processo_rotulo,
        "criado_em": isoformat_ou_nulo(registro.criado_em),
    }


def serialize_registros(registros: Iterable[RegistroAuditoria]):
    registros = list(registros)
    processos = _processos_por_entidade(registros)
    return [serialize_registro(registro, processos) for registro in registros]
