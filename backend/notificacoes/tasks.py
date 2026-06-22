import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name="notificacoes.checar_lembretes")
def checar_lembretes():
    from agenda.models import Evento

    from .models import Notificacao

    agora = timezone.now()
    janela_fim = agora + timedelta(minutes=1)

    eventos = Evento.objects.filter(
        lembrete_em__lte=janela_fim,
        lembrete_em__gte=agora - timedelta(minutes=15),
        lembrete_enviado=False,
        responsavel__isnull=False,
    ).select_related("responsavel", "processo")

    criados = 0
    for evento in eventos:
        Notificacao.objects.create(
            usuario=evento.responsavel,
            tipo="evento",
            titulo=f"Lembrete: {evento.titulo}",
            mensagem=(
                f"Compromisso agendado para "
                f"{evento.data_inicio.strftime('%d/%m/%Y %H:%M')}."
            ),
            link=f"/agenda/{evento.pk}",
        )
        evento.lembrete_enviado = True
        evento.save(update_fields=["lembrete_enviado"])
        criados += 1

    if criados:
        logger.info("checar_lembretes: %d notificação(ões) criada(s).", criados)

    return criados
