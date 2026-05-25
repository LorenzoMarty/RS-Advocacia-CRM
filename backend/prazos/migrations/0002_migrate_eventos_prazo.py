from django.db import migrations


def _is_prazo_event(evento):
    return "prazo" in (evento.tipo_evento or "").casefold()


def migrate_eventos_prazo(apps, schema_editor):
    Evento = apps.get_model("agenda", "Evento")
    Prazo = apps.get_model("prazos", "Prazo")

    migrated_ids = []
    for evento in Evento.objects.all().iterator():
        if not _is_prazo_event(evento):
            continue

        data_base = evento.data_fim or evento.data_inicio
        data_limite = data_base.date() if hasattr(data_base, "date") else data_base
        Prazo.objects.create(
            titulo=evento.titulo,
            descricao=evento.descricao,
            data_limite=data_limite,
            processo_id=evento.processo_id,
            responsavel=evento.responsavel,
            status=evento.status,
            prioridade=evento.prioridade or "Alta",
            observacoes=evento.observacoes,
            concluido=evento.concluido,
            tempo_decorrido_segundos=evento.tempo_decorrido_segundos,
            timer_iniciado_em=evento.timer_iniciado_em,
            criado_por=evento.criado_por,
        )
        migrated_ids.append(evento.pk)

    if migrated_ids:
        Evento.objects.filter(pk__in=migrated_ids).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("agenda", "0006_evento_timer_fields"),
        ("prazos", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(migrate_eventos_prazo, migrations.RunPython.noop),
    ]
