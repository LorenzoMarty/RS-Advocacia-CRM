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


@shared_task(name="notificacoes.checar_prazos")
def checar_prazos():
    from prazos.models import Prazo

    from .models import Notificacao

    hoje = timezone.localdate()
    limite = hoje + timedelta(days=3)

    prazos = Prazo.objects.filter(
        data_limite__gte=hoje,
        data_limite__lte=limite,
        concluido=False,
        notificacao_enviada=False,
        responsavel__isnull=False,
    ).select_related("responsavel", "processo")

    criados = 0
    for prazo in prazos:
        Notificacao.objects.create(
            usuario=prazo.responsavel,
            tipo="prazo",
            titulo=f"Prazo próximo: {prazo.titulo}",
            mensagem=f"Vence em {prazo.data_limite.strftime('%d/%m/%Y')}.",
            link=f"/prazos/{prazo.pk}",
        )
        prazo.notificacao_enviada = True
        prazo.save(update_fields=["notificacao_enviada"])
        criados += 1

    if criados:
        logger.info("checar_prazos: %d notificação(ões) criada(s).", criados)

    return criados
