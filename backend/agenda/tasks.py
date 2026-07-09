import logging

from celery import shared_task

from integrations.google.calendar import sync_local_event
from integrations.google.exceptions import GoogleApiError, GoogleAuthorizationRequired

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    ignore_result=True,
    autoretry_for=(GoogleApiError,),
    retry_backoff=True,
    retry_backoff_max=120,
    max_retries=3,
)
def sincronizar_evento_google_calendar(self, evento_id, usuario_id):
    from agenda.models import Evento
    from usuarios.models import Usuario

    try:
        evento = Evento.objects.get(pk=evento_id)
    except Evento.DoesNotExist:
        return

    usuario = Usuario.objects.filter(pk=usuario_id).first() if usuario_id else None
    if usuario is None:
        return

    try:
        sync_local_event(usuario, evento)
    except GoogleAuthorizationRequired:
        logger.info(
            "Sincronizacao do evento %s pulada: usuario %s sem conta Google conectada.",
            evento_id,
            usuario_id,
        )
