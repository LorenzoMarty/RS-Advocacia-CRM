from django.contrib import admin

from usuarios.models import Cargo, Usuario

# Register your models here.
@admin.register(Cargo)
class CargoAdmin(admin.ModelAdmin):
    list_display = ("nome",)
    search_fields = ("nome",)


@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    list_display = ("nome", "email", "cargo", "OAB")
    search_fields = ("nome", "email")
    list_filter = ("cargo",)
