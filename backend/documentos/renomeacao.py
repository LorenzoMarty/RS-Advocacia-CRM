"""Durable Drive folder renames (outbox pattern).

``registrar`` records, inside the caller's transaction, that a client's or
processo's folder must be renamed in Drive. ``aplicar`` performs it and removes
the record; ``vencidas`` feeds the periodic drain that retries failures (broker
down, Google down, editor without a connected account). The target name is
recomputed from the current row at apply time, so the rename is idempotent and
repeated edits collapse into a single entry.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone

from integrations.google.exceptions import GOOGLE_ERRORS, GoogleAuthorizationRequired
from integrations.models import GoogleAccount

from . import services
from .models import RenomeacaoPastaPendente

logger = logging.getLogger(__name__)

MAX_TENTATIVAS = 8
LOTE_MAXIMO = 50
_ESPERA_INICIAL = timedelta(minutes=1)
_ESPERA_BASE_MINUTOS = 5
_ESPERA_TETO = timedelta(hours=2)


def espera_para(tentativas: int) -> timedelta:
    """Wait before the next attempt: 1 min, then 5, 10, 20... capped at 2 h."""
    if tentativas <= 0:
        return _ESPERA_INICIAL
    minutos = _ESPERA_BASE_MINUTOS * 2 ** (tentativas - 1)
    return min(timedelta(minutes=minutos), _ESPERA_TETO)


def registrar(tipo: str, objeto_id: int, usuario) -> RenomeacaoPastaPendente:
    """Record (or refresh) a pending rename and enqueue the fast path on commit.

    Call it inside the same ``transaction.atomic()`` as the edit so the intent
    cannot be lost. Re-registering resets the attempts, so a new edit retries
    immediately even if an earlier one had given up.
    """
    pendencia, _ = RenomeacaoPastaPendente.objects.update_or_create(
        tipo=tipo,
        objeto_id=objeto_id,
        defaults={
            "usuario": usuario if getattr(usuario, "pk", None) else None,
            "tentativas": 0,
            "ultimo_erro": "",
        },
    )
    transaction.on_commit(lambda: _enfileirar(pendencia.pk))
    return pendencia


def _enfileirar(pendencia_id: int) -> None:
    # Lazy imports: tasks imports this module.
    from core.utils import enfileirar_best_effort
    from documentos.tasks import aplicar_renomeacao

    enfileirar_best_effort(aplicar_renomeacao, pendencia_id)


def vencidas(agora=None):
    """Pending renames due for (another) attempt, oldest first."""
    agora = agora or timezone.now()
    filtro = Q()
    for tentativas in range(MAX_TENTATIVAS):
        filtro |= Q(
            tentativas=tentativas,
            atualizado_em__lte=agora - espera_para(tentativas),
        )
    return RenomeacaoPastaPendente.objects.filter(filtro).order_by("atualizado_em")


def _usuarios_candidatos(pendencia):
    """The editor first, then every other user with a connected Google account."""
    vistos = set()
    if pendencia.usuario_id:
        vistos.add(pendencia.usuario_id)
        yield pendencia.usuario
    contas = GoogleAccount.objects.filter(revoked_at__isnull=True).select_related(
        "usuario"
    )
    for conta in contas:
        if conta.usuario_id not in vistos:
            vistos.add(conta.usuario_id)
            yield conta.usuario


def _entidade(pendencia):
    if pendencia.tipo == RenomeacaoPastaPendente.TIPO_CLIENTE:
        from clientes.models import Cliente

        return Cliente.objects.filter(pk=pendencia.objeto_id).first()
    from processos.models import Processo

    return Processo.objects.filter(pk=pendencia.objeto_id).first()


def _renomear(usuario, pendencia, entidade) -> None:
    if pendencia.tipo == RenomeacaoPastaPendente.TIPO_CLIENTE:
        services.renomear_pasta_cliente(usuario, entidade, entidade.nome)
    else:
        # "" never equals the computed name, so the rename is always applied.
        services.renomear_pasta_processo(usuario, entidade, "")


def _concluir(pendencia) -> None:
    # Optimistic: if a newer edit re-registered the row meanwhile, keep it.
    RenomeacaoPastaPendente.objects.filter(
        pk=pendencia.pk, atualizado_em=pendencia.atualizado_em
    ).delete()


def _falhar(pendencia, erro: str) -> None:
    atualizadas = RenomeacaoPastaPendente.objects.filter(
        pk=pendencia.pk, atualizado_em=pendencia.atualizado_em
    ).update(
        tentativas=F("tentativas") + 1,
        ultimo_erro=erro[:500],
        atualizado_em=timezone.now(),
    )
    if atualizadas and pendencia.tentativas + 1 >= MAX_TENTATIVAS:
        logger.error(
            "Renomear pasta de %s %s desistiu após %s tentativas: %s",
            pendencia.tipo,
            pendencia.objeto_id,
            MAX_TENTATIVAS,
            erro,
        )


def aplicar(pendencia) -> bool:
    """Try to perform one pending rename. Returns ``True`` when it is settled."""
    entidade = _entidade(pendencia)
    if entidade is None:
        _concluir(pendencia)
        return True

    ultimo_erro = "Nenhuma conta Google conectada."
    for usuario in _usuarios_candidatos(pendencia):
        try:
            _renomear(usuario, pendencia, entidade)
        except GoogleAuthorizationRequired as exc:
            ultimo_erro = str(exc) or ultimo_erro
            continue
        except GOOGLE_ERRORS as exc:
            _falhar(pendencia, str(exc))
            return False
        _concluir(pendencia)
        return True

    _falhar(pendencia, ultimo_erro)
    return False
