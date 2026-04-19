from django.contrib import admin
from django.contrib.auth.models import Group

from usuarios.forms import CargoForm, UsuarioForm
from usuarios.models import Cargo, Usuario, cargo_lookup_values


try:
    admin.site.unregister(Group)
except admin.sites.NotRegistered:
    pass


# Register your models here.
@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    form = UsuarioForm
    list_display = ("nome", "email", "cargo")
    search_fields = ("nome", "email")
    list_filter = ("cargo",)

    def has_add_permission(self, request):
        return False


@admin.register(Cargo)
class CargoAdmin(admin.ModelAdmin):
    form = CargoForm
    fields = ("name", "permissions")
    list_display = ("name",)
    search_fields = ("name",)

    def has_module_permission(self, request):
        return any(
            request.user.has_perm(permission)
            for permission in (
                "auth.add_group",
                "auth.change_group",
                "auth.delete_group",
                "auth.view_group",
            )
        )

    def has_add_permission(self, request):
        return request.user.has_perm("auth.add_group")

    def has_change_permission(self, request, obj=None):
        return request.user.has_perm("auth.change_group")

    def has_delete_permission(self, request, obj=None):
        return request.user.has_perm("auth.delete_group")

    def has_view_permission(self, request, obj=None):
        return request.user.has_perm("auth.view_group")

    def save_model(self, request, obj, form, change):
        previous_name = None
        if change and obj.pk:
            previous_name = (
                Cargo.objects.filter(pk=obj.pk).values_list("name", flat=True).first()
            )

        super().save_model(request, obj, form, change)

        if previous_name and previous_name != obj.name:
            Usuario.objects.filter(cargo__in=cargo_lookup_values(previous_name)).update(
                cargo=obj.name
            )
