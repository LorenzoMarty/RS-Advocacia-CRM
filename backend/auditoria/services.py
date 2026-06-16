"""Camada de registro de auditoria — ponto único chamado pelas views.

A escrita é *best-effort*: qualquer falha aqui é logada mas nunca propaga, para
não quebrar o CRUD do usuário (mesma filosofia do sync com o Drive).
"""

import logging

from auditoria.models import RegistroAuditoria
from usuarios.models import Usuario

logger = logging.getLogger(__name__)

# Campos voláteis que não representam mudança real de conteúdo — ignorados no
# diff para não poluir o log com timestamps/ids a cada edição.
CAMPOS_VOLATEIS = ("data_ultima_movimentacao", "atualizado_em", "criado_em", "id", "pk")

_ROTULOS_ENTIDADE = {
    RegistroAuditoria.ENTIDADE_PROCESSO: "Processo",
    RegistroAuditoria.ENTIDADE_PRAZO: "Prazo",
}
_ROTULOS_ACAO = {
    RegistroAuditoria.ACAO_CRIADO: "criado",
    RegistroAuditoria.ACAO_ATUALIZADO: "atualizado",
    RegistroAuditoria.ACAO_EXCLUIDO: "excluído",
}


def resolver_autor(request) -> tuple[int | None, str]:
    """Identifica o autor da ação a partir da sessão/usuário da requisição.

    Consolida a lógica que já existia espalhada em ``_resolver_criador_prazo``
    (prazos) e ``current_usuario``/``_current_usuario`` (oauth/productivity).
    """
    sessao = getattr(request, "session", None)
    if sessao is not None:
        usuario_id = sessao.get("usuario_id")
        if usuario_id:
            usuario = Usuario.objects.filter(pk=usuario_id).first()
            if usuario:
                return usuario.pk, usuario.nome

        nome_sessao = (sessao.get("usuario_nome") or "").strip()
        if nome_sessao:
            return None, nome_sessao

    auth_user = getattr(request, "user", None)
    if auth_user is not None and getattr(auth_user, "is_authenticated", False):
        for value in (auth_user.email, auth_user.username):
            if not value:
                continue
            usuario = Usuario.objects.filter(email=value).first()
            if usuario:
                return usuario.pk, usuario.nome

        obter_nome = getattr(auth_user, "get_full_name", None)
        if callable(obter_nome):
            nome_completo = (obter_nome() or "").strip()
            if nome_completo:
                return None, nome_completo

        for atributo in ("first_name", "username", "email"):
            valor = (getattr(auth_user, atributo, "") or "").strip()
            if valor:
                return None, valor

    return None, "Sistema"


def calcular_diff(
    antes: dict, depois: dict, campos_ignorados: tuple[str, ...] = CAMPOS_VOLATEIS
) -> dict:
    """Compara dois dicts ``serialize_*`` e retorna ``{campo: {de, para}}``."""
    diff: dict[str, dict] = {}
    chaves = set(antes) | set(depois)
    for campo in chaves:
        if campo in campos_ignorados:
            continue
        valor_antes = antes.get(campo)
        valor_depois = depois.get(campo)
        if valor_antes != valor_depois:
            diff[campo] = {"de": valor_antes, "para": valor_depois}
    return diff


def _montar_resumo(acao: str, entidade_tipo: str, rotulo: str, alteracoes: dict) -> str:
    nome_entidade = _ROTULOS_ENTIDADE.get(entidade_tipo, entidade_tipo)
    verbo = _ROTULOS_ACAO.get(acao, acao)
    rotulo_txt = f" '{rotulo}'" if rotulo else ""
    base = f"{nome_entidade}{rotulo_txt} {verbo}"
    if acao == RegistroAuditoria.ACAO_ATUALIZADO and alteracoes:
        campos = ", ".join(sorted(alteracoes))
        return f"{base}: {campos}"
    return base


def registrar(
    request,
    *,
    acao: str,
    entidade_tipo: str,
    entidade_id,
    rotulo: str = "",
    alteracoes: dict | None = None,
) -> RegistroAuditoria | None:
    """Cria um ``RegistroAuditoria``. Nunca levanta exceção para a view."""
    alteracoes = alteracoes or {}
    try:
        autor_id, autor_nome = resolver_autor(request)
        resumo = _montar_resumo(acao, entidade_tipo, rotulo, alteracoes)
        return RegistroAuditoria.objects.create(
            acao=acao,
            entidade_tipo=entidade_tipo,
            entidade_id=str(entidade_id),
            entidade_rotulo=rotulo or "",
            autor_id=autor_id,
            autor_nome=autor_nome,
            resumo=resumo,
            alteracoes=alteracoes,
        )
    except Exception:  # noqa: BLE001 — auditoria nunca quebra o CRUD
        logger.exception("Falha ao registrar auditoria (%s %s)", acao, entidade_tipo)
        return None
