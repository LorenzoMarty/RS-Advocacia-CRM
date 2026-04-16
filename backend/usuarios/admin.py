from django.contrib import admin
from usuarios.forms import CargoForm, UsuarioForm
from usuarios.models import Usuario
from usuarios.models import Cargo


# Register your models here.
@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    form = UsuarioForm
    list_display = ("nome", "email", "cargo")
    search_fields = ("nome", "email")
    list_filter = ("cargo",)


@admin.register(Cargo)
class CargoAdmin(admin.ModelAdmin):
    form = CargoForm
    list_display = ("nome",)
    search_fields = ("nome",)
