from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from ai.providers.openai_provider import OpenAIProvider


def get_provider():
    provider_name = getattr(settings, "AI_PROVIDER", "openai")
    if provider_name == "openai":
        return OpenAIProvider()

    raise ImproperlyConfigured(f"Provider de IA não suportado: {provider_name}.")
