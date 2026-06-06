from django.apps import AppConfig


class ProcessosConfig(AppConfig):
    name = 'processos'

    def ready(self):
        from . import signals  # noqa: F401
