from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from notificacoes.services import criar_notificacao

from .models import Prospect


@receiver(pre_save, sender=Prospect)
def _capturar_responsavel_anterior(sender, instance, **kwargs):
    anterior_id = None
    if instance.pk:
        anterior_id = (
            Prospect.objects.filter(pk=instance.pk)
            .values_list("responsavel_interno_id", flat=True)
            .first()
        )
    instance._responsavel_interno_anterior_id = anterior_id


@receiver(post_save, sender=Prospect)
def notificar_atribuicao_prospect(sender, instance, created, **kwargs):
    anterior_id = getattr(instance, "_responsavel_interno_anterior_id", None)
    if not instance.responsavel_interno_id:
        return
    if not created and anterior_id == instance.responsavel_interno_id:
        return

    criar_notificacao(
        instance.responsavel_interno,
        "atribuicao",
        f"Prospect atribuído: {instance.nome}",
        mensagem="Você foi definido como responsável por este prospect.",
        link=f"/prospeccao/{instance.pk}",
    )
