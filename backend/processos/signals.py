"""Keep Processo.data_ultima_movimentacao in sync with related records.

Editing the process directly already bumps the field (auto_now). These signals
extend "movement" to mean any change in the process's related deadlines, events
and petitions, so the audit dashboard can flag stale (parado) processes.
"""

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from agenda.models import Evento
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
