import logging

from ai.models import UsoIA

logger = logging.getLogger(__name__)


def registrar_uso_seguro(operacao: str, provider) -> None:
    """Best-effort usage logging: never lets a tracking failure break the
    caller's AI result. ``provider.last_usage`` is a plain dict set by
    OpenAIProvider after each call; anything else (missing, wrong shape, a
    test double) degrades to zeroed usage instead of raising."""
    usage = getattr(provider, "last_usage", None)
    if not isinstance(usage, dict):
        usage = {}
    try:
        UsoIA.objects.create(
            operacao=operacao,
            modelo=str(usage.get("modelo") or ""),
            tokens_entrada=int(usage.get("tokens_entrada") or 0),
            tokens_saida=int(usage.get("tokens_saida") or 0),
        )
    except Exception:
        logger.exception("Falha ao registrar uso de IA (operacao=%s).", operacao)
