from typing import Any, cast

from django.contrib import messages
from django.contrib.auth import login as auth_login, logout as auth_logout
from django.contrib.auth.models import AnonymousUser, Group, Permission, User
from django.db.models import Q
from django.http import HttpRequest
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils.http import url_has_allowed_host_and_scheme

from agenda.models import Evento
from core.permissions import app_permissions_required
from core.permission_utils import get_accessible_url, get_permitted_url_or_fallback
from processos.models import Processo
from usuarios.forms import (
    CargoForm,
    LoginForm,
    UsuarioForm,
    cargo_permissions_for_display,
    normalize_cargo_name,
)
from usuarios.models import Usuario

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
    "Estagiário": {
        "clientes.view_cliente",
        "processos.view_processo",
        "agenda.view_evento",
        "agenda.add_evento",
        "agenda.change_evento",
    },
}


def _resolve_login_redirect(request: HttpRequest, auth_user: User | None = None) -> str:
    next_url = _get_requested_next_url(request)
    if next_url:
        return next_url

    if auth_user is not None:
        return get_accessible_url(auth_user)

    return reverse("dashboard")


def _get_requested_next_url(request: HttpRequest) -> str:
    next_url = request.POST.get("next") or request.GET.get("next")
    if next_url and url_has_allowed_host_and_scheme(
        next_url,
        allowed_hosts={request.get_host()},
        require_https=request.is_secure(),
    ):
        return next_url
    return ""


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
    if cargo.permissions.exists():
        return

    default_permissions = DEFAULT_CARGO_PERMISSIONS.get(cargo.name)
    if default_permissions is None:
        if cargo.name == "Administrador":
            cargo.permissions.set(Permission.objects.all())
        return

    permission_filter = Q()
    for permission_path in default_permissions:
        app_label, codename = permission_path.split(".", 1)
        permission_filter |= Q(content_type__app_label=app_label, codename=codename)

    if permission_filter:
        cargo.permissions.set(Permission.objects.filter(permission_filter))


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


def _get_cargos() -> list[Group]:
    _ensure_default_cargos()
    return list(Group.objects.order_by("name"))


@app_permissions_required("usuarios.view_usuario")
def listar_usuarios(request):
    usuarios = Usuario.objects.all()
    return render(request, "listar_usuarios.html", {"usuarios": usuarios})


@app_permissions_required("usuarios.add_usuario")
def criar_usuario(request):
    _ensure_default_cargos()

    if request.method == "POST":
        form = UsuarioForm(request.POST)
        if form.is_valid():
            usuario = form.save()
            auth_user = _get_or_sync_auth_user(usuario)
            _sync_auth_user_cargo(usuario, auth_user)
            messages.success(request, "Usuário criado com sucesso!")
            return render(request, "criar_usuario.html", {"form": UsuarioForm(), "success": True})
    else:
        form = UsuarioForm()

    return render(request, "criar_usuario.html", {"form": form})


@app_permissions_required("usuarios.view_usuario")
def detalhes_usuario(request, usuario_id):
    usuario = get_object_or_404(Usuario, pk=usuario_id)
    auth_user = _get_or_sync_auth_user(usuario)
    _sync_auth_user_cargo(usuario, auth_user)
    processos = Processo.objects.filter(advogado_responsavel=usuario.nome).select_related("cliente")
    eventos = Evento.objects.filter(responsavel=usuario.nome).select_related("cliente", "processo")

    context = {
        "usuario": usuario,
        "processos": processos,
        "eventos": eventos,
        "cargos": auth_user.groups.order_by("name"),
        "permissoes_total": len(auth_user.get_group_permissions()),
    }
    return render(request, "detalhes_usuario.html", context)


@app_permissions_required("usuarios.change_usuario")
def editar_usuario(request, usuario_id):
    _ensure_default_cargos()
    usuario = get_object_or_404(Usuario, pk=usuario_id)
    previous_email = usuario.email

    if request.method == "POST":
        form = UsuarioForm(request.POST, instance=usuario)
        if form.is_valid():
            usuario = form.save()
            auth_user = _get_or_sync_auth_user(usuario, previous_email=previous_email)
            _sync_auth_user_cargo(usuario, auth_user)
            messages.success(request, "Usuário atualizado com sucesso!")
            return redirect(
                get_permitted_url_or_fallback(
                    request,
                    "usuarios.view_usuario",
                    "detalhes_usuario",
                    args=[usuario.pk],
                )
            )
    else:
        form = UsuarioForm(instance=usuario)

    context = {"form": form, "editar": True}
    return render(request, "criar_usuario.html", context)


@app_permissions_required("usuarios.delete_usuario")
def excluir_usuario(request, usuario_id):
    usuario = get_object_or_404(Usuario, pk=usuario_id)

    if request.method == "POST":
        auth_user = _find_auth_user(usuario.email)
        if auth_user is not None:
            auth_user.delete()
        usuario.delete()
        messages.success(request, "Usuário excluído com sucesso!")
        return redirect(
            get_permitted_url_or_fallback(
                request,
                "usuarios.view_usuario",
                "listar_usuarios",
            )
        )

    context = {
        "registro_tipo": "usuario",
        "registro_nome": usuario.nome,
        "registro_meta": usuario.email,
        "voltar_url": reverse("detalhes_usuario", args=[usuario.pk]),
        "voltar_permission": "usuarios.view_usuario",
    }
    return render(request, "confirmar_exclusao.html", context)


@app_permissions_required("auth.view_group")
def listar_cargos(request):
    cargos_data: list[dict[str, Any]] = []

    for cargo in _get_cargos():
        apps = list(
            cargo.permissions.order_by("content_type__app_label")
            .values_list("content_type__app_label", flat=True)
            .distinct()[:3]
        )
        cargos_data.append(
            {
                "id": cargo.pk,
                "name": cargo.name,
                "permissoes_total": cargo.permissions.count(),
                "usuarios_total": Usuario.objects.filter(cargo=cargo.name).count(),
                "apps": apps,
            }
        )

    return render(request, "listar_cargos.html", {"cargos": cargos_data})


@app_permissions_required("auth.add_group")
def criar_cargo(request):
    next_url = _get_requested_next_url(request)

    if request.method == "POST":
        form = CargoForm(request.POST)
        if form.is_valid():
            cargo = form.save()
            messages.success(request, "Cargo criado com sucesso!")
            if next_url:
                return redirect(next_url)
            return redirect(
                get_permitted_url_or_fallback(
                    request,
                    "auth.view_group",
                    "detalhes_cargo",
                    args=[cargo.pk],
                )
            )
    else:
        form = CargoForm()

    return render(
        request,
        "criar_cargo.html",
        {
            "form": form,
            "next_url": next_url,
            "selected_permission_ids": {str(pk) for pk in (form["permissions"].value() or [])},
        },
    )


@app_permissions_required("auth.view_group")
def detalhes_cargo(request, cargo_id):
    cargo = get_object_or_404(Group, pk=cargo_id)
    permissions = cargo.permissions.select_related("content_type").all()
    usuarios_vinculados = Usuario.objects.filter(cargo=cargo.name).order_by("nome")

    context = {
        "cargo": cargo,
        "permission_sections": cargo_permissions_for_display(permissions),
        "usuarios_vinculados": usuarios_vinculados,
        "usuarios_total": usuarios_vinculados.count(),
        "permissoes_total": len(permissions),
    }
    return render(request, "detalhes_cargo.html", context)


@app_permissions_required("auth.change_group")
def editar_cargo(request, cargo_id):
    cargo = get_object_or_404(Group, pk=cargo_id)
    previous_name = cargo.name

    if request.method == "POST":
        form = CargoForm(request.POST, instance=cargo)
        if form.is_valid():
            cargo = form.save()
            if previous_name != cargo.name:
                Usuario.objects.filter(cargo=previous_name).update(cargo=cargo.name)
            messages.success(request, "Cargo atualizado com sucesso!")
            return redirect(
                get_permitted_url_or_fallback(
                    request,
                    "auth.view_group",
                    "detalhes_cargo",
                    args=[cargo.pk],
                )
            )
    else:
        form = CargoForm(instance=cargo)

    return render(
        request,
        "criar_cargo.html",
        {
            "form": form,
            "editar": True,
            "cargo": cargo,
            "cargo_nome": cargo.name,
            "selected_permission_ids": {str(pk) for pk in (form["permissions"].value() or [])},
        },
    )


@app_permissions_required("auth.delete_group")
def excluir_cargo(request, cargo_id):
    cargo = get_object_or_404(Group, pk=cargo_id)
    usuarios_vinculados = Usuario.objects.filter(cargo=cargo.name).count()

    if request.method == "POST":
        if usuarios_vinculados:
            messages.error(request, "Remova ou altere os usuários vinculados antes de excluir este cargo.")
            return redirect(
                get_permitted_url_or_fallback(
                    request,
                    "auth.view_group",
                    "detalhes_cargo",
                    args=[cargo.pk],
                )
            )

        cargo.delete()
        messages.success(request, "Cargo excluído com sucesso!")
        return redirect(
            get_permitted_url_or_fallback(
                request,
                "auth.view_group",
                "listar_cargos",
            )
        )

    context = {
        "registro_tipo": "cargo",
        "registro_nome": cargo.name,
        "registro_meta": (
            f"{usuarios_vinculados} usuário{'s' if usuarios_vinculados != 1 else ''} vinculados"
            if usuarios_vinculados
            else f"{cargo.permissions.count()} permissões"
        ),
        "voltar_url": reverse("detalhes_cargo", args=[cargo.pk]),
        "voltar_permission": "auth.view_group",
    }

    if usuarios_vinculados:
        context.update(
            {
                "confirm_blocked": True,
                "confirm_alert_title": "Exclusão indisponível no momento.",
                "confirm_alert_copy": (
                    "Este cargo ainda possui usuários vinculados. "
                    "Altere ou remova esses vínculos antes de tentar excluir."
                ),
            }
        )

    return render(request, "confirmar_exclusao.html", context)


def login(request: HttpRequest):
    request_user = cast(User | AnonymousUser, getattr(request, "user", None))
    auth_user = request_user if isinstance(request_user, User) and request_user.is_authenticated else None

    if request.method == "GET":
        if auth_user is not None:
            return redirect(_resolve_login_redirect(request, auth_user))
        if request.session.get("usuario_id"):
            _clear_usuario_session(request)

    if request.method == "POST":
        if auth_user is not None:
            auth_logout(request)
        _clear_usuario_session(request)
        form = LoginForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data["email"]
            senha = form.cleaned_data["senha"]

            try:
                usuario = Usuario.objects.get(email=email, senha=senha)
            except Usuario.DoesNotExist:
                form.add_error(None, "Email ou senha inválidos.")
            else:
                auth_user = _get_or_sync_auth_user(usuario)
                _sync_auth_user_cargo(usuario, auth_user)
                auth_login(request, auth_user, backend="django.contrib.auth.backends.ModelBackend")
                request.session["usuario_id"] = usuario.pk
                request.session["usuario_nome"] = usuario.nome
                request.session["usuario_email"] = usuario.email
                messages.success(request, f"Bem-vindo, {usuario.nome}!")
                return redirect(_resolve_login_redirect(request, auth_user))
    else:
        form = LoginForm()

    return render(
        request,
        "login.html",
        {
            "form": form,
            "next_url": request.GET.get("next", ""),
        },
    )


def logout(request: HttpRequest):
    if request.user.is_authenticated:
        auth_logout(request)
    _clear_usuario_session(request)
    messages.info(request, "Você saiu da sua conta.")
    return redirect("login")


def current_usuario(request: HttpRequest):
    usuario = None
    usuario_id = request.session.get("usuario_id")

    if usuario_id:
        usuario = Usuario.objects.filter(pk=usuario_id).only("id", "nome", "email").first()

    request_user = cast(User | AnonymousUser, getattr(request, "user", None))
    if usuario is None and request_user and request_user.is_authenticated:
        auth_identifier = getattr(request_user, "email", "") or getattr(request_user, "username", "")
        if auth_identifier:
            usuario = (
                Usuario.objects.filter(email=auth_identifier)
                .only("id", "nome", "email")
                .first()
            )
            if usuario:
                request.session["usuario_id"] = usuario.pk
                request.session["usuario_nome"] = usuario.nome
                request.session["usuario_email"] = usuario.email

    return {"usuario_logado": usuario}
