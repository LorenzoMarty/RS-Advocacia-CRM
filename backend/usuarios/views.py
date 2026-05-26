from typing import Any, cast

from django.contrib.auth import logout as encerrar_sessao_django
from django.contrib.auth.models import AnonymousUser, Group, Permission, User
from django.db.models import Q
from django.http import HttpRequest
from django.shortcuts import get_object_or_404

from core.permissions import app_any_permissions_required, app_permissions_required
from core.utils import (
    resposta_erro,
    erros_formulario,
    metodo_nao_permitido,
    ler_corpo_json,
    resposta_sucesso,
)
from usuarios.forms import (
    CargoForm,
    PERMISSION_APP_LABELS,
    UsuarioForm,
    _format_permission_name,
    normalize_cargo_name,
)
from usuarios.models import Cargo, Usuario, cargo_lookup_values
from integrations.google.calendar import calendar_label
from integrations.models import GoogleAccount


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
        "prazos.view_prazo",
        "prazos.add_prazo",
        "prazos.change_prazo",
        "peticoes.view_peticao",
        "peticoes.add_peticao",
        "peticoes.change_peticao",
        "meetings.view_reuniao",
        "meetings.add_reuniao",
        "meetings.change_reuniao",
        "meetings.delete_reuniao",
        "meetings.view_gravacao",
        "meetings.add_gravacao",
        "meetings.change_gravacao",
        "meetings.delete_gravacao",
        "usuarios.view_usuario",
    },
    ESTAGIARIO_CARGO_NAME: {
        "clientes.view_cliente",
        "processos.view_processo",
        "agenda.view_evento",
        "agenda.add_evento",
        "agenda.change_evento",
        "prazos.view_prazo",
        "prazos.add_prazo",
        "prazos.change_prazo",
        "peticoes.view_peticao",
        "peticoes.add_peticao",
        "peticoes.change_peticao",
        "meetings.view_reuniao",
        "meetings.add_reuniao",
        "meetings.view_gravacao",
        "meetings.add_gravacao",
    },
}

PERMISSION_ACTION_API_LABELS = {
    "add": "criar",
    "change": "editar",
    "delete": "excluir",
    "view": "visualizar",
}

CARGO_LIST_PERMISSIONS = (
    "auth.view_group",
    "auth.add_group",
    "auth.change_group",
    "usuarios.view_usuario",
    "usuarios.add_usuario",
    "usuarios.change_usuario",
)


def _clear_usuario_session(request: HttpRequest) -> None:
    request.session.pop("usuario_id", None)
    request.session.pop("usuario_nome", None)
    request.session.pop("usuario_email", None)


def _remember_usuario_session(request: HttpRequest, usuario: Usuario) -> None:
    request.session["usuario_id"] = usuario.pk
    request.session["usuario_nome"] = usuario.nome
    request.session["usuario_email"] = usuario.email


def _authenticated_user(request: HttpRequest) -> User | None:
    request_user = cast(User | AnonymousUser | None, getattr(request, "user", None))
    if (
        request_user is None
        or isinstance(request_user, AnonymousUser)
        or not request_user.is_authenticated
    ):
        return None
    return cast(User, request_user)


def _ensure_default_cargos() -> list[Group]:
    cargos = []
    for _legacy_value, cargo_label in Usuario.TIPOS:
        cargo, _ = Cargo.objects.get_or_create(name=cargo_label)
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


def _get_or_sync_auth_user(
    usuario: Usuario,
    previous_email: str | None = None,
    preferred_auth_user: User | None = None,
) -> User:
    auth_user: User | None = preferred_auth_user
    created = False

    if auth_user is None:
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
    cargo, _ = Cargo.objects.get_or_create(name=normalized_name)
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


def _sync_usuario_auth(
    usuario: Usuario,
    previous_email: str | None = None,
    preferred_auth_user: User | None = None,
) -> User:
    auth_user = _get_or_sync_auth_user(
        usuario,
        previous_email=previous_email,
        preferred_auth_user=preferred_auth_user,
    )
    _sync_auth_user_cargo(usuario, auth_user)
    return auth_user


def _get_cargos() -> list[Group]:
    _ensure_default_cargos()
    return list(Cargo.objects.order_by("name"))


def serialize_permission(permission: Permission):
    action, _, model_name = permission.codename.partition("_")
    action_label = PERMISSION_ACTION_API_LABELS.get(action, action)
    return {
        "id": str(permission.pk),
        "caminho": f"{permission.content_type.app_label}.{permission.codename}",
        "nome": _format_permission_name(permission),
        "modelo": model_name.replace("_", " ").title()
        or permission.content_type.model.title(),
        "modulo": permission.content_type.app_label,
        "acao": action_label,
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
                "chave": app_label,
                "rotulo": PERMISSION_APP_LABELS.get(app_label, app_label.title()),
                "permissoes": [],
            },
        )
        grouped[app_label]["permissoes"].append(serialize_permission(permission))

    return list(grouped.values())


def _usuarios_for_cargo(cargo: Group):
    return Usuario.objects.filter(cargo__in=cargo_lookup_values(cargo.name))


def serialize_cargo(cargo: Group):
    permission_ids = [str(pk) for pk in cargo.permissions.values_list("pk", flat=True)]
    return {
        "id": str(cargo.pk),
        "pk": cargo.pk,
        "nome": cargo.name,
        "permissoes": permission_ids,
        "permissoes_total": cargo.permissions.count(),
        "usuarios_total": _usuarios_for_cargo(cargo).count(),
    }


def _cargo_map_for_usuarios(usuarios: list[Usuario]) -> dict[str, Cargo]:
    cargo_names = {
        cargo_name
        for usuario in usuarios
        if (cargo_name := normalize_cargo_name(usuario.cargo))
    }
    return {cargo.name: cargo for cargo in Cargo.objects.filter(name__in=cargo_names)}


def serialize_usuario(
    usuario: Usuario,
    cargos_by_name: dict[str, Cargo] | None = None,
):
    cargo_nome = normalize_cargo_name(usuario.cargo)
    cargo = (
        cargos_by_name.get(cargo_nome)
        if cargos_by_name is not None
        else Cargo.objects.filter(name=cargo_nome).first()
    )
    account = GoogleAccount.objects.filter(usuario=usuario).first()
    return {
        "id": str(usuario.pk),
        "pk": usuario.pk,
        "nome": usuario.nome,
        "email": usuario.email,
        "foto": usuario.picture,
        "cargo": cargo_nome,
        "cargo_id": str(cargo.pk) if cargo else cargo_nome,
        "google_calendar_conectado": bool(account and account.connected),
        "google_calendar_destino": calendar_label(usuario),
    }


def serialize_usuarios(usuarios):
    usuarios = list(usuarios)
    cargos_by_name = _cargo_map_for_usuarios(usuarios)
    return [
        serialize_usuario(usuario, cargos_by_name=cargos_by_name)
        for usuario in usuarios
    ]


def _usuario_response(usuario: Usuario):
    serialized = serialize_usuario(usuario)
    return {"usuario": serialized}


def _usuarios_response(usuarios):
    serialized = serialize_usuarios(usuarios)
    return {"usuarios": serialized}


def _cargo_response(cargo: Group):
    serialized = serialize_cargo(cargo)
    return {"cargo": serialized}


def _cargos_response(cargos):
    serialized = [serialize_cargo(cargo) for cargo in cargos]
    return {"cargos": serialized}


def _resolve_cargo_api_value(value):
    if value in (None, ""):
        return value

    value = str(value)
    cargo = Cargo.objects.filter(pk=value).first() if value.isdigit() else None
    if cargo is None:
        cargo = Cargo.objects.filter(name=value).first()
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
    payload = ler_corpo_json(request)
    data = dict(payload)
    if "cargo_id" in payload and "cargo" not in data:
        data["cargo"] = payload["cargo_id"]
    if "cargo" in data:
        data["cargo"] = _resolve_cargo_api_value(data["cargo"])
    return data


def _cargo_api_payload(request):
    payload = ler_corpo_json(request)
    data = dict(payload)
    if "nome" in payload and "name" not in data:
        data["name"] = payload["nome"]
    if "permissoes" in payload and "permissions" not in data:
        data["permissions"] = payload["permissoes"]
    data["permissions"] = _normalize_permission_values(data.get("permissions"))
    return data


@app_permissions_required("usuarios.view_usuario")
def listar_usuarios(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    _ensure_default_cargos()
    return resposta_sucesso(_usuarios_response(Usuario.objects.all()))


@app_permissions_required("usuarios.view_usuario")
def detalhes_usuario(request, usuario_id):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    usuario = get_object_or_404(Usuario, pk=usuario_id)
    auth_user = _sync_usuario_auth(usuario)
    cargos = [serialize_cargo(cargo) for cargo in auth_user.groups.order_by("name")]

    return resposta_sucesso(
        {
            **_usuario_response(usuario),
            "cargos": cargos,
            "permissoes_total": len(auth_user.get_group_permissions()),
        }
    )


@app_permissions_required("usuarios.change_usuario")
def editar_usuario(request, usuario_id):
    if request.method not in {"PUT", "PATCH"}:
        return metodo_nao_permitido(["PUT", "PATCH"])

    _ensure_default_cargos()
    usuario = get_object_or_404(Usuario, pk=usuario_id)
    previous_email = usuario.email

    try:
        payload = _usuario_api_payload(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    form = UsuarioForm(payload, instance=usuario)
    if form.is_valid():
        usuario = form.save()
        _sync_usuario_auth(usuario, previous_email=previous_email)
        return resposta_sucesso(
            _usuario_response(usuario),
            mensagem="Usuário atualizado com sucesso.",
        )

    return resposta_erro(erros_formulario(form), status=400)


@app_permissions_required("usuarios.delete_usuario")
def excluir_usuario(request, usuario_id):
    if request.method != "DELETE":
        return metodo_nao_permitido(["DELETE"])

    usuario = get_object_or_404(Usuario, pk=usuario_id)
    deleted_id = str(usuario.pk)
    auth_user = _find_auth_user(usuario.email)
    if auth_user is not None:
        auth_user.delete()
    usuario.delete()
    return resposta_sucesso({"id": deleted_id}, mensagem="Usuário excluído com sucesso.")


@app_any_permissions_required(*CARGO_LIST_PERMISSIONS)
def listar_cargos(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    return resposta_sucesso(_cargos_response(_get_cargos()))


@app_permissions_required("auth.add_group")
def criar_cargo(request):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    try:
        payload = _cargo_api_payload(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    form = CargoForm(payload)
    if form.is_valid():
        cargo = form.save()
        return resposta_sucesso(
            _cargo_response(cargo),
            mensagem="Cargo criado com sucesso.",
            status=201,
        )

    return resposta_erro(erros_formulario(form), status=400)


@app_permissions_required("auth.view_group")
def detalhes_cargo(request, cargo_id):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    cargo = get_object_or_404(Cargo, pk=cargo_id)
    usuarios_vinculados = _usuarios_for_cargo(cargo).order_by("nome")
    usuarios = serialize_usuarios(usuarios_vinculados)
    return resposta_sucesso(
        {
            **_cargo_response(cargo),
            "usuarios_vinculados": usuarios,
        }
    )


@app_permissions_required("auth.change_group")
def editar_cargo(request, cargo_id):
    if request.method not in {"PUT", "PATCH"}:
        return metodo_nao_permitido(["PUT", "PATCH"])

    cargo = get_object_or_404(Cargo, pk=cargo_id)
    previous_name = cargo.name

    try:
        payload = _cargo_api_payload(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    form = CargoForm(payload, instance=cargo)
    if form.is_valid():
        cargo = form.save()
        if previous_name != cargo.name:
            Usuario.objects.filter(
                cargo__in=cargo_lookup_values(previous_name)
            ).update(cargo=cargo.name)
        return resposta_sucesso(
            _cargo_response(cargo),
            mensagem="Cargo atualizado com sucesso.",
        )

    return resposta_erro(erros_formulario(form), status=400)


@app_permissions_required("auth.delete_group")
def excluir_cargo(request, cargo_id):
    if request.method != "DELETE":
        return metodo_nao_permitido(["DELETE"])

    cargo = get_object_or_404(Cargo, pk=cargo_id)
    usuarios_vinculados = _usuarios_for_cargo(cargo).count()

    if usuarios_vinculados:
        return resposta_erro(
            {
                "cargo": [
                    "Remova ou altere os usuários vinculados antes de excluir este cargo."
                ]
            },
            status=409,
        )

    deleted_id = str(cargo.pk)
    cargo.delete()
    return resposta_sucesso({"id": deleted_id}, mensagem="Cargo excluído com sucesso.")


def sair(request: HttpRequest):
    if request.method not in {"POST", "DELETE"}:
        return metodo_nao_permitido(["POST", "DELETE"])

    if _authenticated_user(request) is not None:
        encerrar_sessao_django(request)
    _clear_usuario_session(request)
    return resposta_sucesso(mensagem="Sessão encerrada.")


def usuario_atual(request: HttpRequest):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    usuario = get_usuario_atual(request)["usuario_logado"]
    if usuario is None:
        from core.demo_data import ensure_demo_session

        usuario = ensure_demo_session(request)

    auth_user = _authenticated_user(request)
    if usuario and auth_user is not None:
        _sync_usuario_auth(usuario, preferred_auth_user=auth_user)

    return resposta_sucesso(
        {"usuario": serialize_usuario(usuario) if usuario else None}
    )


def get_usuario_atual(request: HttpRequest):
    usuario = None
    usuario_id = request.session.get("usuario_id")

    if usuario_id:
        usuario = Usuario.objects.filter(pk=usuario_id).first()

    auth_user = _authenticated_user(request)
    if usuario is None and auth_user is not None:
        auth_identifier = auth_user.email or auth_user.username
        if auth_identifier:
            usuario = Usuario.objects.filter(email=auth_identifier).first()
            if usuario:
                _remember_usuario_session(request, usuario)

    return {"usuario_logado": usuario}
