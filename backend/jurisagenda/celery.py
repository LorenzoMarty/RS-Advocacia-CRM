import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "jurisagenda.settings")

app = Celery("jurisagenda")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

app.conf.beat_schedule = {
    "checar-lembretes-every-15-min": {
        "task": "notificacoes.checar_lembretes",
        "schedule": crontab(minute="*/15"),
    },
    "checar-prazos-every-15-min": {
        "task": "notificacoes.checar_prazos",
        "schedule": crontab(minute="*/15"),
    },
    "sincronizar-drive-every-10-min": {
        "task": "documentos.sincronizar_drive",
        "schedule": crontab(minute="*/10"),
    },
}
