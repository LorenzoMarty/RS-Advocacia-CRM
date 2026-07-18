from django.contrib import admin

from .models import OpcaoPersonalizada


@admin.register(OpcaoPersonalizada)
class OpcaoPersonalizadaAdmin(admin.ModelAdmin):
    list_display = ("campo", "valor", "criado_em")
    list_filter = ("campo",)
    search_fields = ("valor",)
