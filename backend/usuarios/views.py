from typing import Any, cast

from django.contrib.auth import login as auth_login, logout as auth_logout
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import AnonymousUser, Group, Permission, User
from django.db.models import Q
from django.http import HttpRequest
from django.shortcuts import get_object_or_404

from agenda.models import Evento
from core.permissions import app_permissions_required
from core.utils import (
    error_response,
    form_errors,
    method_not_allowed,
    parse_body,
    payload_with_aliases,
    success_response,
)
from processos.models import Processo
from usuarios.forms import (
    CargoForm,
    LoginForm,
    PERMISSION_APP_LABELS,
    UsuarioForm,
    _format_permission_name,
    cargo_permissions_for_display,
    is_password_hash,
    normalize_cargo_name,
)
from usuarios.models import Usuario


ESTAGIARIO_CARGO_NAME = dict(Usuario.TIPOS).get("estagiario", "Estagiario")

DEFAULT_CARGO_PERMISSIONS = {
    "Administrador": None,
    "Advogado": {
        "clientes.view_cliente",
        "clientes.add_cliente",
        "clientes.change_cliente",
        "processos.view_processo",
        "processos.add_processo",
        "processos.change_processo",
        "agenda.view_evento",
        "agenda.add_evento",
        "agenda.change_evento",
        "usuarios.view_usuario",
    },
    ESTAGIARIO_CARGO_NAME: {
        "clientes.view_cliente",
        "processos.view_processo",
        "agenda.view_evento",
        "agenda.add_evento",
        "agenda.change_evento",
    },
}

USUARIO_API_ALIASES = {
    "name": "nome",
    "password": "senha",
    "role": "cargo",
}

CARGO_API_ALIASES = {
    "permissionIds": "permissions",
}

PERMISSION_ACTION_API_LABELS = {
    "add": "create",
    "change": "edit",
    "delete": "delete",
    "view": "view",
}


def _clear_usuario_session(request: HttpRequest) -> None:
    request.session.pop("usuario_id", None)
    request.session.pop("usuario_nome", None)
    request.session.pop("usuario_email", None)


def _ensure_default_cargos() -> list[Group]:
    cargos = []
    for _legacy_value, cargo_label in Usuario.TIPOS:
        cargo, _ = Group.objects.get_or_create(name=cargo_label)
        _apply_default_cargo_permissions(cargo)
        cargos.append(cargo)
    return cargos


def _apply_default_cargo_permissions(cargo: Group) -> None:
    default_permissions = DEFAULT_CARGO_PERMISSIONS.get(cargo.name)
    if default_permissions is None:
        if cargo.name == "Administrador":
            missing_permissions = Permission.objects.exclude(
                pk__in=cargo.permissions.values_list("pk", flat=True)
            )
            if missing_permissions.exists():
                cargo.permissions.add(*missing_permissions)
        return

    permission_filter = Q()
    for permission_path in default_permissions:
        app_label, codename = permission_path.split(".", 1)
        permission_filter |= Q(content_type__app_label=app_label, codename=codename)

    if permission_filter:
        missing_permissions = Permission.objects.filter(permission_filter).exclude(
            pk__in=cargo.permissions.values_list("pk", flat=True)
        )
        if missing_permissions.exists():
            cargo.permissions.add(*missing_permissions)


def _find_auth_user(identifier: str) -> User | None:
    auth_user = User.objects.filter(username=identifier).first()
    if auth_user is None:
        auth_user = User.objects.filter(email=identifier).first()
    return auth_user


def _get_or_sync_auth_user(usuario: Usuario, previous_email: str | None = None) -> User:
    auth_user: User | None = None
    created = False

    for identifier in (previous_email, usuario.email):
        if not identifier:
            continue
        auth_user = _find_auth_user(identifier)
        if auth_user is not None:
            break

    if auth_user is None:
        auth_user = User(username=usuario.email)
        created = True

    updated_fields = []
    if auth_user.username != usuario.email:
        auth_user.username = usuario.email
        updated_fields.append("username")
    if auth_user.email != usuario.email:
        auth_user.email = usuario.email
        updated_fields.append("email")
    if auth_user.first_name != usuario.nome:
        auth_user.first_name = usuario.nome
        updated_fields.append("first_name")
    if created:
        auth_user.set_unusable_password()
        updated_fields.append("password")

    if updated_fields:
        if created:
            auth_user.save()
        else:
            auth_user.save(update_fields=updated_fields)

    return auth_user


def _get_or_create_cargo(cargo_name: str) -> Group | None:
    normalized_name = str(normalize_cargo_name(cargo_name) or "").strip()
    if not normalized_name:
        return None
    cargo, _ = Group.objects.get_or_create(name=normalized_name)
    _apply_default_cargo_permissions(cargo)
    return cargo


def _sync_auth_user_cargo(usuario: Usuario, auth_user: User) -> Group | None:
    cargo = _get_or_create_cargo(usuario.cargo)
    if cargo is None:
        auth_user.groups.clear()
        return None

    auth_user.groups.set([cargo])
    if usuario.cargo != cargo.name:
        Usuario.objects.filter(pk=usuario.pk).update(cargo=cargo.name)
        usuario.cargo = cargo.name

    return cargo


def _usuario_password_matches(usuario: Usuario, raw_password: str) -> bool:
    if is_password_hash(usuario.senha):
        return check_password(raw_password, usuario.senha)

    if usuario.senha != raw_password:
        return False

    usuario.senha = make_password(raw_password)
    usuario.save(update_fields=["senha"])
    return True


def _get_cargos() -> list[Group]:
    _ensure_default_cargos()
    return list(Group.objects.order_by("name"))


def serialize_permission(permission: Permission):
    action, _, model_name = permission.codename.partition("_")
    action_label = PERMISSION_ACTION_API_LABELS.get(action, action)
    return {
        "id": str(permission.pk),
        "path": f"{permission.content_type.app_label}.{permission.codename}",
        "displayName": _format_permission_name(permission),
        "modelLabel": model_name.replace("_", " ").title()
        or permission.content_type.model.title(),
        "app": permission.content_type.app_label,
        "action": action_label,
    }


def serialize_permission_groups():
    grouped: dict[str, dict[str, Any]] = {}
    permissions = Permission.objects.select_related("content_type").filter(
        content_type__app_label__in=PERMISSION_APP_LABELS.keys()
    )

    for permission in permissions.order_by(
        "content_type__app_label", "content_type__model", "codename"
    ):
        app_label = permission.content_type.app_label
        grouped.setdefault(
            app_label,
            {
                "key": app_label,
                "label": PERMISSION_APP_LABELS.get(app_label, app_label.title()),
                "permissions": [],
            },
        )
        grouped[app_label]["permissions"].append(serialize_permission(permission))

    return list(grouped.values())


def _cargo_lookup_values(cargo_name: str) -> set[str]:
    values = {cargo_name}

    for legacy_value, cargo_label in Usuario.TIPOS:
        if cargo_label == cargo_name:
            values.add(legacy_value)
        if legacy_value == cargo_name:
            values.add(cargo_label)

    return values


def _usuarios_for_cargo(cargo: Group):
    return Usuario.objects.filter(cargo__in=_cargo_lookup_values(cargo.name))


def serialize_cargo(cargo: Group):
    permission_ids = [str(pk) for pk in cargo.permissions.values_list("pk", flat=True)]
    return {
        "id": str(cargo.pk),
        "pk": cargo.pk,
        "name": cargo.name,
        "nome": cargo.name,
        "permissions": permission_ids,
        "permissionIds": permission_ids,
        "permissoes_total": cargo.permissions.count(),
        "usuarios_total": _usuarios_for_cargo(cargo).count(),
    }


def serialize_usuario(usuario: Usuario):
    cargo_nome = normalize_cargo_name(usuario.cargo)
    cargo = Group.objects.filter(name=cargo_nome).first()
    return {
        "id": str(usuario.pk),
        "pk": usuario.pk,
        "nome": usuario.nome,
        "name": usuario.nome,
        "email": usuario.email,
        "cargo": cargo_nome,
        "roleId": str(cargo.pk) if cargo else cargo_nome,
    }


def _resolve_cargo_api_value(value):
    if value in (None, ""):
        return value

    value = str(value)
    cargo = Group.objects.filter(pk=value).first() if value.isdigit() else None
    if cargo is None:
        cargo = Group.objects.filter(name=value).first()
    return cargo.name if cargo else value


def _normalize_permission_values(values):
    if values in (None, ""):
        return []

    if not isinstance(values, (list, tuple, set)):
        values = [values]

    normalized = []
    for value in values:
        value = str(value)
        if value.isdigit():
            normalized.append(value)
            continue

        if "." in value:
            app_label, codename = value.split(".", 1)
            permission = Permission.objects.filter(
                content_type__app_label=app_label,
                codename=codename,
            ).first()
            if permission:
                normalized.append(str(permission.pk))

    return normalized


def _usuario_api_payload(request):
    payload = parse_body(request)
    data = payload_with_aliases(payload, USUARIO_API_ALIASES)
    if "roleId" in payload and "cargo" not in data:
        data["cargo"] = payload["roleId"]
    if "cargo" in data:
        data["cargo"] = _resolve_cargo_api_value(data["cargo"])
    return data


def _cargo_api_payload(request):
    payload = parse_body(request)
    data = payload_with_aliases(payload, CARGO_API_ALIASES)
    data["permissions"] = _normalize_permission_values(data.get("permissions"))
    return data


@app_permissions_required("usuarios.view_usuario")
def listar_usuarios(request):
    if request.method != "GET":
        return method_not_allowed(["GET"])

    usuarios = Usuario.objects.all()
    serialized = [serialize_usuario(usuario) for usuario in usuarios]
    return success_response({"usuarios": serialized, "users": serialized})


@app_permissions_required("usuarios.add_usuario")
def criar_usuario(request):
    if request.method != "POST":
        return method_not_allowed(["POST"])

    _ensure_default_cargos()

    try:
        payload = _usuario_api_payload(request)
    except ValueError as exc:
        return error_response(str(exc), status=400)

    form = UsuarioForm(payload)
    if form.is_valid():
        usuario = form.save()
        auth_user = _get_or_sync_auth_user(usuario)
        _sync_auth_user_cargo(usuario, auth_user)
        serialized = serialize_usuario(usuario)
        return success_response(
            {"usuario": serialized, "user": serialized},
            message="Usuario criado com sucesso.",
            status=201,
        )

    return error_response(form_errors(form), status=400)


@app_permissions_required("usuarios.view_usuario")
def detalhes_usuario(request, usuario_id):
    if request.method != "GET":
        return method_not_allowed(["GET"])

    usuario = get_object_or_404(Usuario, pk=usuario_id)
    auth_user = _get_or_sync_auth_user(usuario)
    _sync_auth_user_cargo(usuario, auth_user)
    processos = Processo.objects.filter(
        advogado_responsavel=usuario.nome
    ).select_related("cliente")
    eventos = Evento.objects.filter(responsavel=usuario.nome).select_related(
        "cliente", "processo"
    )

    from agenda.views import serialize_evento
    from processos.views import serialize_processo

    serialized_processos = [serialize_processo(processo) for processo in processos]
    serialized_eventos = [serialize_evento(evento) for evento in eventos]
    serialized_cargos = [
        serialize_cargo(cargo) for cargo in auth_user.groups.order_by("name")
    ]
    serialized_usuario = serialize_usuario(usuario)

    return success_response(
        {
            "usuario": serialized_usuario,
            "user": serialized_usuario,
            "processos": serialized_processos,
            "processes": serialized_processos,
            "eventos": serialized_eventos,
            "events": serialized_eventos,
            "cargos": serialized_cargos,
            "roles": serialized_cargos,
            "permissoes_total": len(auth_user.get_group_permissions()),
        }
    )


@app_permissions_required("usuarios.change_usuario")
def editar_usuario(request, usuario_id):
    if request.method not in {"PUT", "PATCH"}:
        return method_not_allowed(["PUT", "PATCH"])

    _ensure_default_cargos()
    usuario = get_object_or_404(Usuario, pk=usuario_id)
    previous_email = usuario.email

    try:
        payload = _usuario_api_payload(request)
    except ValueError as exc:
        return error_response(str(exc), status=400)

    if not payload.get("senha"):
        payload["senha"] = usuario.senha

    form = UsuarioForm(payload, instance=usuario)
    if form.is_valid():
        usuario = form.save()
        auth_user = _get_or_sync_auth_user(usuario, previous_email=previous_email)
        _sync_auth_user_cargo(usuario, auth_user)
        serialized = serialize_usuario(usuario)
        return success_response(
            {"usuario": serialized, "user": serialized},
            message="Usuario atualizado com sucesso.",
        )

    return error_response(form_errors(form), status=400)


@app_permissions_required("usuarios.delete_usuario")
def excluir_usuario(request, usuario_id):
    if request.method != "DELETE":
        return method_not_allowed(["DELETE"])

    usuario = get_object_or_404(Usuario, pk=usuario_id)
    deleted_id = str(usuario.pk)
    auth_user = _find_auth_user(usuario.email)
    if auth_user is not None:
        auth_user.delete()
    usuario.delete()
    return success_response({"id": deleted_id}, message="Usuario excluido com sucesso.")


@app_permissions_required("auth.view_group")
def listar_cargos(request):
    if request.method != "GET":
        return method_not_allowed(["GET"])

    cargos = _get_cargos()
    serialized = [serialize_cargo(cargo) for cargo in cargos]
    return success_response({"cargos": serialized, "roles": serialized})


@app_permissions_required("auth.add_group")
def criar_cargo(request):
    if request.method != "POST":
        return method_not_allowed(["POST"])

    try:
        payload = _cargo_api_payload(request)
    except ValueError as exc:
        return error_response(str(exc), status=400)

    form = CargoForm(payload)
    if form.is_valid():
        cargo = form.save()
        serialized = serialize_cargo(cargo)
        return success_response(
            {"cargo": serialized, "role": serialized},
            message="Cargo criado com sucesso.",
            status=201,
        )

    return error_response(form_errors(form), status=400)


@app_permissions_required("auth.view_group")
def detalhes_cargo(request, cargo_id):
    if request.method != "GET":
        return method_not_allowed(["GET"])

    cargo = get_object_or_404(Group, pk=cargo_id)
    usuarios_vinculados = _usuarios_for_cargo(cargo).order_by("nome")
    permission_sections = []
    for section in cargo_permissions_for_display(
        cargo.permissions.select_related("content_type").all()
    ):
        permission_sections.append(
            {
                "key": section["key"],
                "label": section["label"],
                "permissions": [
                    {
                        "permission": serialize_permission(item["permission"]),
                        "display_name": item["display_name"],
                        "model_label": item["model_label"],
                    }
                    for item in section["permissions"]
                ],
            }
        )

    serialized_cargo = serialize_cargo(cargo)
    serialized_usuarios = [
        serialize_usuario(usuario) for usuario in usuarios_vinculados
    ]
    return success_response(
        {
            "cargo": serialized_cargo,
            "role": serialized_cargo,
            "usuarios_vinculados": serialized_usuarios,
            "users": serialized_usuarios,
            "permission_sections": permission_sections,
        }
    )


@app_permissions_required("auth.change_group")
def editar_cargo(request, cargo_id):
    if request.method not in {"PUT", "PATCH"}:
        return method_not_allowed(["PUT", "PATCH"])

    cargo = get_object_or_404(Group, pk=cargo_id)
    previous_name = cargo.name

    try:
        payload = _cargo_api_payload(request)
    except ValueError as exc:
        return error_response(str(exc), status=400)

    form = CargoForm(payload, instance=cargo)
    if form.is_valid():
        cargo = form.save()
        if previous_name != cargo.name:
            Usuario.objects.filter(cargo__in=_cargo_lookup_values(previous_name)).update(cargo=cargo.name)
        serialized = serialize_cargo(cargo)
        return success_response(
            {"cargo": serialized, "role": serialized},
            message="Cargo atualizado com sucesso.",
        )

    return error_response(form_errors(form), status=400)


@app_permissions_required("auth.delete_group")
def excluir_cargo(request, cargo_id):
    if request.method != "DELETE":
        return method_not_allowed(["DELETE"])

    cargo = get_object_or_404(Group, pk=cargo_id)
    usuarios_vinculados = _usuarios_for_cargo(cargo).count()

    if usuarios_vinculados:
        return error_response(
            {
                "cargo": [
                    "Remova ou altere os usuarios vinculados antes de excluir este cargo."
                ]
            },
            status=409,
        )

    deleted_id = str(cargo.pk)
    cargo.delete()
    return success_response({"id": deleted_id}, message="Cargo excluido com sucesso.")


def login(request: HttpRequest):
    if request.method != "POST":
        return method_not_allowed(["POST"])

    request_user = cast(User | AnonymousUser, getattr(request, "user", None))
    auth_user = (
        request_user
        if isinstance(request_user, User) and request_user.is_authenticated
        else None
    )

    if auth_user is not None:
        auth_logout(request)
    _clear_usuario_session(request)

    try:
        payload = parse_body(request)
    except ValueError as exc:
        return error_response(str(exc), status=400)

    form = LoginForm(
        payload_with_aliases(payload, {"password": "senha", "username": "email"})
    )
    if form.is_valid():
        email = form.cleaned_data["email"]
        senha = form.cleaned_data["senha"]

        usuario = Usuario.objects.filter(email=email).first()
        if usuario is None or not _usuario_password_matches(usuario, senha):
            form.add_error(None, "Email ou senha invalidos.")
        else:
            auth_user = _get_or_sync_auth_user(usuario)
            _sync_auth_user_cargo(usuario, auth_user)
            auth_login(
                request, auth_user, backend="django.contrib.auth.backends.ModelBackend"
            )
            request.session["usuario_id"] = usuario.pk
            request.session["usuario_nome"] = usuario.nome
            request.session["usuario_email"] = usuario.email
            serialized = serialize_usuario(usuario)
            return success_response(
                {"usuario": serialized, "user": serialized},
                message=f"Bem-vindo, {usuario.nome}.",
            )

    return error_response(form_errors(form), status=400)


def logout(request: HttpRequest):
    if request.method not in {"POST", "DELETE"}:
        return method_not_allowed(["POST", "DELETE"])

    if request.user.is_authenticated:
        auth_logout(request)
    _clear_usuario_session(request)
    return success_response(message="Sessao encerrada.")


def current_usuario(request: HttpRequest):
    if request.method != "GET":
        return method_not_allowed(["GET"])

    usuario = get_current_usuario(request)["usuario_logado"]
    return success_response(
        {"usuario": serialize_usuario(usuario) if usuario else None}
    )


def get_current_usuario(request: HttpRequest):
    usuario = None
    usuario_id = request.session.get("usuario_id")

    if usuario_id:
        usuario = Usuario.objects.filter(pk=usuario_id).first()

    request_user = cast(User | AnonymousUser, getattr(request, "user", None))
    if usuario is None and request_user and request_user.is_authenticated:
        auth_identifier = getattr(request_user, "email", "") or getattr(
            request_user, "username", ""
        )
        if auth_identifier:
            usuario = Usuario.objects.filter(email=auth_identifier).first()
            if usuario:
                request.session["usuario_id"] = usuario.pk
                request.session["usuario_nome"] = usuario.nome
                request.session["usuario_email"] = usuario.email

    return {"usuario_logado": usuario}
