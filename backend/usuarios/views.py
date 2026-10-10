
from django.contrib.auth import logout as encerrar_sessao_django
from django.contrib.auth.models import Group, Permission, User
from django.db.models import Q
from django.http import HttpRequest
from django.shortcuts import get_object_or_404

from auditoria import services as auditoria_services
from auditoria.models import RegistroAuditoria
from core.identity import authenticated_user, current_usuario
from core.pagination import paginar
from core.permissions import app_permissions_required
from core.utils import (
    erros_formulario,
    ler_corpo_json,
    metodo_nao_permitido,
    resposta_erro,
    resposta_sucesso,
)
from usuarios.forms import (
    UsuarioForm,
    normalize_cargo_name,
)
from usuarios.models import Cargo, Usuario
from usuarios.serializers import serialize_usuario, serialize_usuarios

ESTAGIARIO_CARGO_NAME = dict(Usuario.TIPOS).get("estagiario", "Estagiario")

ADVOGADO_CARGO_PERMISSIONS = {
    "clientes.view_cliente",
    "clientes.add_cliente",
    "clientes.change_cliente",
    "clientes.delete_cliente",
    "documentos.view_documentocliente",
    "documentos.add_documentocliente",
    "documentos.change_documentocliente",
    "documentos.delete_documentocliente",
    "processos.view_processo",
    "processos.add_processo",
    "processos.change_processo",
    "processos.delete_processo",
    "agenda.view_evento",
    "agenda.add_evento",
    "agenda.change_evento",
    "agenda.delete_evento",
    "prazos.view_prazo",
    "prazos.add_prazo",
    "prazos.change_prazo",
    "prazos.delete_prazo",
    "peticoes.view_peticao",
    "peticoes.add_peticao",
    "peticoes.change_peticao",
    "peticoes.delete_peticao",
    "productivity.view_timeentry",
    "productivity.add_timeentry",
    "productivity.change_timeentry",
    "productivity.view_productivitygoal",
    "productivity.add_productivitygoal",
    "productivity.change_productivitygoal",
    "productivity.delete_productivitygoal",
    "prospeccao.view_prospect",
    "prospeccao.add_prospect",
    "prospeccao.change_prospect",
    "prospeccao.delete_prospect",
    "meetings.view_reuniao",
    "meetings.add_reuniao",
    "meetings.change_reuniao",
    "meetings.delete_reuniao",
    "meetings.view_gravacao",
    "meetings.add_gravacao",
    "meetings.change_gravacao",
    "meetings.delete_gravacao",
    # Gestão de usuários (usuarios.*) e financeiro (financeiro.*) são exclusivos do
    # Administrador — não entram no conjunto padrão dos demais cargos.
}

STANDARD_CARGO_NAMES = {
    "Advogado",
    ESTAGIARIO_CARGO_NAME,
    "Estagiario",
}

REMOVED_CARGO_REASSIGNMENTS = {
    "Assistente Jurídico": "Advogado",
    "Assistente Juridico": "Advogado",
    "Assistente juridico": "Advogado",
    "assistente juridico": "Advogado",
}

STANDARD_CARGO_PERMISSION_APP_LABELS = (
    "agenda",
    "clientes",
    "documentos",
    "meetings",
    "peticoes",
    "prazos",
    "processos",
    "productivity",
    "prospeccao",
)

DEFAULT_CARGO_PERMISSIONS = {
    # Administrador = todas as permissões (None sinaliza "tudo").
    "Administrador": None,
    # Advogado e Estagiário compartilham o mesmo conjunto padrão.
    "Advogado": ADVOGADO_CARGO_PERMISSIONS,
    ESTAGIARIO_CARGO_NAME: ADVOGADO_CARGO_PERMISSIONS,
}

def _clear_usuario_session(request: HttpRequest) -> None:
    request.session.pop("usuario_id", None)
    request.session.pop("usuario_nome", None)
    request.session.pop("usuario_email", None)


def _remember_usuario_session(request: HttpRequest, usuario: Usuario) -> None:
    request.session["usuario_id"] = usuario.pk
    request.session["usuario_nome"] = usuario.nome
    request.session["usuario_email"] = usuario.email


def _ensure_default_cargos() -> list[Group]:
    _retire_removed_cargos()
    cargos = []
    should_create_missing = not Cargo.objects.exists()

    for _legacy_value, cargo_label in Usuario.TIPOS:
        cargo = Cargo.objects.filter(name=cargo_label).first()
        if cargo is None:
            if not should_create_missing:
                continue
            cargo = Cargo.objects.create(name=cargo_label)
        _apply_default_cargo_permissions(cargo)
        cargos.append(cargo)
    return cargos


def _retire_removed_cargos() -> None:
    for removed_name, replacement_name in REMOVED_CARGO_REASSIGNMENTS.items():
        Usuario.objects.filter(cargo=removed_name).update(cargo=replacement_name)
    Cargo.objects.filter(name__in=REMOVED_CARGO_REASSIGNMENTS.keys()).delete()


def _apply_default_cargo_permissions(cargo: Group) -> None:
    if cargo.name == "Administrador":
        cargo.permissions.set(Permission.objects.all())
        return

    if cargo.name in STANDARD_CARGO_NAMES:
        cargo.permissions.set(
            Permission.objects.filter(
                content_type__app_label__in=STANDARD_CARGO_PERMISSION_APP_LABELS
            )
        )
        return

    default_permissions = DEFAULT_CARGO_PERMISSIONS.get(cargo.name)
    if not default_permissions:
        return

    permission_filter = Q()
    for permission_path in default_permissions:
        app_label, codename = permission_path.split(".", 1)
        permission_filter |= Q(content_type__app_label=app_label, codename=codename)

    cargo.permissions.set(Permission.objects.filter(permission_filter))


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


def _usuario_response(usuario: Usuario):
    serialized = serialize_usuario(usuario)
    return {"usuario": serialized}


def _usuarios_response(usuarios):
    serialized = serialize_usuarios(usuarios)
    return {"usuarios": serialized}


def _resolve_cargo_api_value(value):
    if value in (None, ""):
        return value

    value = str(value)
    cargo = Cargo.objects.filter(pk=value).first() if value.isdigit() else None
    if cargo is None:
        cargo = Cargo.objects.filter(name=value).first()
    return cargo.name if cargo else value


def _usuario_api_payload(request):
    payload = ler_corpo_json(request)
    data = dict(payload)
    if "cargo_id" in payload and "cargo" not in data:
        data["cargo"] = payload["cargo_id"]
    if "cargo" in data:
        data["cargo"] = _resolve_cargo_api_value(data["cargo"])
    return data


@app_permissions_required("usuarios.view_usuario")
def listar_usuarios(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    _ensure_default_cargos()
    usuarios = Usuario.objects.order_by("nome")
    pagina, paginacao = paginar(usuarios, request)
    resposta = _usuarios_response(pagina)
    resposta["paginacao"] = paginacao
    return resposta_sucesso(resposta)


@app_permissions_required("usuarios.add_usuario")
def criar_usuario(request):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    _ensure_default_cargos()

    try:
        payload = _usuario_api_payload(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    form = UsuarioForm(payload)
    if form.is_valid():
        usuario = form.save()
        _sync_usuario_auth(usuario)
        return resposta_sucesso(
            _usuario_response(usuario),
            mensagem="Usuário criado com sucesso.",
            status=201,
        )

    return resposta_erro(erros_formulario(form), status=400)


@app_permissions_required("usuarios.view_usuario")
def detalhes_usuario(request, usuario_id):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    usuario = get_object_or_404(Usuario, pk=usuario_id)
    _sync_usuario_auth(usuario)

    return resposta_sucesso(
        {
            **_usuario_response(usuario),
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

    usuario_logado = _usuario_logado(request)
    if usuario_logado and usuario_logado.pk == usuario.pk:
        return resposta_erro(
            {"usuario": ["Você não pode excluir o próprio usuário."]}, status=400
        )

    if normalize_cargo_name(usuario.cargo) == "Administrador":
        existe_outro_admin = (
            Usuario.objects.filter(cargo="Administrador").exclude(pk=usuario.pk).exists()
        )
        if not existe_outro_admin:
            return resposta_erro(
                {"usuario": ["Não é possível excluir o último Administrador."]},
                status=400,
            )

    deleted_id = str(usuario.pk)
    deleted_nome = usuario.nome
    auth_user = _find_auth_user(usuario.email)
    if auth_user is not None:
        auth_user.delete()
    usuario.delete()

    auditoria_services.registrar(
        request,
        acao=RegistroAuditoria.ACAO_EXCLUIDO,
        entidade_tipo=RegistroAuditoria.ENTIDADE_USUARIO,
        entidade_id=deleted_id,
        rotulo=deleted_nome,
    )

    return resposta_sucesso(
        {"id": deleted_id}, mensagem="Usuário excluído com sucesso."
    )


def sair(request: HttpRequest):
    if request.method not in {"POST", "DELETE"}:
        return metodo_nao_permitido(["POST", "DELETE"])

    if authenticated_user(request) is not None:
        encerrar_sessao_django(request)
    _clear_usuario_session(request)
    return resposta_sucesso(mensagem="Sessão encerrada.")


def usuario_atual(request: HttpRequest):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    usuario = _usuario_logado(request)

    auth_user = authenticated_user(request)
    if usuario and auth_user is not None:
        _sync_usuario_auth(usuario, preferred_auth_user=auth_user)

    return resposta_sucesso(
        {"usuario": serialize_usuario(usuario) if usuario else None}
    )


def _usuario_logado(request: HttpRequest) -> Usuario | None:
    """Current ``Usuario``; re-pins it in the session when found via the auth user."""
    usuario = current_usuario(request)
    if usuario is not None and request.session.get("usuario_id") != usuario.pk:
        _remember_usuario_session(request, usuario)
    return usuario
