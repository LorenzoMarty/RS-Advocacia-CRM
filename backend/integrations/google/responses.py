"""Shared translation of Google Drive/auth errors into the JSON envelope.

Used by any view that drives the Drive integration (documentos, peticoes,
prazos) so the error mapping lives in one place and never leaks a stack trace.
"""

from __future__ import annotations

import logging

from django.conf import settings

from core.utils import resposta_erro

from .exceptions import (
    GoogleApiError,
    GoogleAuthorizationRequired,
    GoogleConfigurationError,
)

logger = logging.getLogger(__name__)


def mapear_erro_google(exc):
    """Return a JSON-envelope error response for a Google exception, or None."""
    if isinstance(exc, GoogleConfigurationError):
        return resposta_erro(str(exc), status=503)
    if isinstance(exc, GoogleAuthorizationRequired):
        return resposta_erro(str(exc), status=401)
    if isinstance(exc, GoogleApiError):
        logger.warning("Erro da API Google Drive: %s", exc)
        detalhe = "Não foi possível concluir a operação no Google Drive."
        if settings.DEBUG:
            causa = exc.__cause__
            status = getattr(getattr(causa, "resp", None), "status", None)
            detalhe = f"{detalhe} [debug status={status}] {str(causa)[:400]}"
        return resposta_erro(detalhe, status=502)
    return None
