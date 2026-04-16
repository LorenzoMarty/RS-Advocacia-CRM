from collections import OrderedDict

from django import forms
from django.contrib.auth.hashers import identify_hasher, make_password
from django.contrib.auth.models import Permission

from usuarios.models import Cargo, Usuario

PERMISSION_APP_LABELS = OrderedDict(
    (
        ("clientes", "Clientes"),
        ("processos", "Processos"),
        ("agenda", "Agenda"),
        ("usuarios", "Usuários"),
        ("auth", "Sistema"),
    )
)

PERMISSION_ACTION_LABELS = (
    ("Can add ", "Criar "),
    ("Can change ", "Editar "),
    ("Can delete ", "Excluir "),
    ("Can view ", "Visualizar "),
)


def _format_permission_name(permission):
    name = permission.name
    for source, target in PERMISSION_ACTION_LABELS:
        if name.startswith(source):
            return name.replace(source, target, 1)
    return name


def cargo_permissions_for_display(permissions):
    visible_permissions = [
        permission
        for permission in permissions
        if permission.content_type.app_label in PERMISSION_APP_LABELS
    ]
    visible_permissions.sort(
        key=lambda permission: (
            list(PERMISSION_APP_LABELS).index(permission.content_type.app_label),
            permission.content_type.model,
            permission.name,
        )
    )

    sections = []
    grouped = OrderedDict()

    for permission in visible_permissions:
        app_label = permission.content_type.app_label
        grouped.setdefault(
            app_label,
            {
                "key": app_label,
                "label": PERMISSION_APP_LABELS[app_label],
                "permissions": [],
            },
        )
        grouped[app_label]["permissions"].append(
            {
                "permission": permission,
                "display_name": _format_permission_name(permission),
                "model_label": permission.content_type.model.replace("_", " "),
            }
        )

    sections.extend(grouped.values())
    return sections


def normalize_cargo_name(cargo_value):
    return dict(Usuario.TIPOS).get(cargo_value, cargo_value)


def is_password_hash(value):
    if not value:
        return False

    try:
        identify_hasher(value)
    except ValueError:
        return False
    return True


def get_available_cargo_choices(current_value=None):
    cargos = list(Cargo.objects.order_by("name").values_list("name", flat=True))

    for _legacy_value, cargo_label in Usuario.TIPOS:
        if cargo_label not in cargos:
            cargos.append(cargo_label)

    normalized_current = normalize_cargo_name(current_value) if current_value else ""
    if normalized_current and normalized_current not in cargos:
        cargos.append(normalized_current)

    return [(cargo, cargo) for cargo in cargos]


class UsuarioForm(forms.ModelForm):
    cargo = forms.ChoiceField(label="Cargo")

    class Meta:
        model = Usuario
        fields = ["nome", "email", "senha", "cargo"]
        widgets = {
            "senha": forms.PasswordInput(render_value=True),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        current_value = self.instance.cargo if self.instance and self.instance.pk else None
        self.fields["cargo"].choices = get_available_cargo_choices(current_value)
        if current_value:
            self.initial["cargo"] = normalize_cargo_name(current_value)

    def save(self, commit=True):
        usuario = super().save(commit=False)
        senha = self.cleaned_data.get("senha")
        if senha and not is_password_hash(senha):
            usuario.senha = make_password(senha)

        if commit:
            usuario.save()
            self.save_m2m()

        return usuario


class CargoForm(forms.ModelForm):
    permissions = forms.ModelMultipleChoiceField(
        label="Permissões",
        queryset=Permission.objects.select_related("content_type").order_by(
            "content_type__app_label",
            "content_type__model",
            "name",
        ),
        required=False,
    )

    class Meta:
        model = Cargo
        fields = ["name", "permissions"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["name"].label = "Nome do cargo"
        self.fields["name"].widget.attrs.update(
            {
                "placeholder": "Ex.: Financeiro, Operacional, Coordenação",
                "autocomplete": "off",
            }
        )
        self.permission_sections = cargo_permissions_for_display(self.fields["permissions"].queryset)


class LoginForm(forms.Form):
    email = forms.EmailField(
        label="Email",
        widget=forms.EmailInput(
            attrs={
                "placeholder": "voce@empresa.com",
                "autocomplete": "email",
                "inputmode": "email",
            }
        ),
    )
    senha = forms.CharField(
        label="Senha",
        widget=forms.PasswordInput(
            attrs={
                "placeholder": "Digite sua senha",
                "autocomplete": "current-password",
            }
        ),
    )
