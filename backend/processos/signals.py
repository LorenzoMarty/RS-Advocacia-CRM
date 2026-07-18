"""Keep Processo.data_ultima_movimentacao in sync with related records.

Editing the process directly already bumps the field (auto_now). These signals
extend "movement" to mean any change in the process's related deadlines, events
and petitions, so the audit dashboard can flag stale (parado) processes.
"""

from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from agenda.models import Evento
from notificacoes.services import criar_notificacao
from peticoes.models import Peticao
from prazos.models import Prazo
from processos.models import Processo


def _touch_processo(processo_id):
    if not processo_id:
        return
    # update() avoids re-triggering post_save on Processo and skips auto_now,
    # so we set the timestamp explicitly.
    from django.utils import timezone

    Processo.objects.filter(pk=processo_id).update(
        data_ultima_movimentacao=timezone.now()
    )


@receiver(post_save, sender=Prazo)
@receiver(post_delete, sender=Prazo)
@receiver(post_save, sender=Evento)
@receiver(post_delete, sender=Evento)
@receiver(post_save, sender=Peticao)
@receiver(post_delete, sender=Peticao)
def registrar_movimentacao_relacionada(sender, instance, **kwargs):
    _touch_processo(getattr(instance, "processo_id", None))


@receiver(pre_save, sender=Processo)
def _capturar_responsavel_anterior(sender, instance, **kwargs):
    anterior_id = None
    if instance.pk:
        anterior_id = (
            Processo.objects.filter(pk=instance.pk)
            .values_list("advogado_responsavel_id", flat=True)
            .first()
        )
    instance._advogado_responsavel_anterior_id = anterior_id


@receiver(post_save, sender=Processo)
def notificar_atribuicao_processo(sender, instance, created, **kwargs):
    anterior_id = getattr(instance, "_advogado_responsavel_anterior_id", None)
    if not instance.advogado_responsavel_id:
        return
    if not created and anterior_id == instance.advogado_responsavel_id:
        return

    criar_notificacao(
        instance.advogado_responsavel,
        "atribuicao",
        f"Processo atribuído: {instance.numero_processo}",
        mensagem="Você foi definido como advogado responsável por este processo.",
        link=f"/processos/{instance.pk}",
    )
