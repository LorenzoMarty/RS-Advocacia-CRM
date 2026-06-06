"""Endpoints de saúde para liveness/readiness probes.

`/health/` é liveness puro: responde 200 sem tocar dependências externas.
`/ready/` é readiness: verifica banco, cache e broker (quando configurado) e
responde 200 quando tudo está saudável ou 503 quando algo falha. As respostas
trazem apenas status booleano por dependência — sem versões, hosts ou detalhes
que possam vazar topologia.
"""

import logging

from django.conf import settings
from django.core.cache import cache
from django.db import connections
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from core.utils import metodo_nao_permitido

logger = logging.getLogger(__name__)


@csrf_exempt
def health(request):
    """Liveness: o processo está de pé e respondendo."""
    if request.method not in {"GET", "HEAD"}:
        return metodo_nao_permitido(["GET", "HEAD"])
    return JsonResponse({"status": "ok"})


def _check_database() -> bool:
    try:
        connection = connections["default"]
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return True
    except Exception:
        logger.exception("Readiness: falha ao checar banco de dados")
        return False


def _check_cache() -> bool:
    try:
        cache.set("healthcheck:ready", "1", timeout=5)
        return cache.get("healthcheck:ready") == "1"
    except Exception:
        logger.exception("Readiness: falha ao checar cache")
        return False


def _check_broker() -> bool | None:
    """Checa o broker Celery. Retorna None quando não há broker configurado."""
    broker_url = getattr(settings, "CELERY_BROKER_URL", "")
    if not broker_url:
        return None
    try:
        from jurisagenda.celery import app

        connection = app.connection()
        try:
            connection.ensure_connection(max_retries=1, timeout=2)
        finally:
            connection.release()
        return True
    except Exception:
        logger.exception("Readiness: falha ao checar broker")
        return False


@csrf_exempt
def ready(request):
    """Readiness: dependências necessárias para servir tráfego estão saudáveis."""
    if request.method not in {"GET", "HEAD"}:
        return metodo_nao_permitido(["GET", "HEAD"])

    checks: dict[str, str] = {
        "database": "ok" if _check_database() else "error",
        "cache": "ok" if _check_cache() else "error",
    }

    broker = _check_broker()
    if broker is not None:
        checks["broker"] = "ok" if broker else "error"

    healthy = all(value == "ok" for value in checks.values())
    payload = {"status": "ok" if healthy else "error", "checks": checks}
    return JsonResponse(payload, status=200 if healthy else 503)
