from django.contrib import admin
from usuarios.forms import UsuarioForm
from usuarios.models import Usuario


# Register your models here.
@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    form = UsuarioForm
    list_display = ("nome", "email", "cargo")
    search_fields = ("nome", "email")
    list_filter = "cargo"
