from django.apps import AppConfig


class ProspeccaoConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "prospeccao"

    def ready(self):
        from . import signals  # noqa: F401
