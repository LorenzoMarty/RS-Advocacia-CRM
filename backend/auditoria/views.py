from django.contrib.auth.models import AnonymousUser, User
from django.http import HttpRequest

from auditoria.models import RegistroAuditoria
from core.permissions import app_permissions_required
from core.utils import (
    isoformat_ou_nulo,
    metodo_nao_permitido,
    resposta_erro,
    resposta_sucesso,
)
from usuarios.models import Usuario

LIMITE_PADRAO = 100
LIMITE_MAXIMO = 300


def _authenticated_user(request: HttpRequest) -> User | None:
    request_user = getattr(request, "user", None)
    if (
        request_user is None
        or isinstance(request_user, AnonymousUser)
        or not getattr(request_user, "is_authenticated", False)
    ):
        return None
    return request_user


def _current_usuario(request: HttpRequest) -> Usuario | None:
    usuario_id = request.session.get("usuario_id")
    if usuario_id:
        usuario = Usuario.objects.filter(pk=usuario_id).first()
        if usuario:
            return usuario

    auth_user = _authenticated_user(request)
    if not auth_user:
        return None

    for value in (auth_user.email, auth_user.username):
        if not value:
            continue
        usuario = Usuario.objects.filter(email=value).first()
        if usuario:
            return usuario

    return None


def _is_admin(request: HttpRequest, usuario: Usuario | None = None) -> bool:
    auth_user = _authenticated_user(request)
    if auth_user and (auth_user.is_staff or auth_user.is_superuser):
        return True
    if auth_user and auth_user.groups.filter(name="Administrador").exists():
        return True
    return usuario is not None and usuario.cargo == "Administrador"


def serialize_registro(registro: RegistroAuditoria):
    return {
        "id": str(registro.pk),
        "pk": registro.pk,
        "acao": registro.acao,
        "entidade_tipo": registro.entidade_tipo,
        "entidade_id": registro.entidade_id,
        "entidade_rotulo": registro.entidade_rotulo,
        "autor_nome": registro.autor_nome,
        "resumo": registro.resumo,
        "alteracoes": registro.alteracoes,
        "criado_em": isoformat_ou_nulo(registro.criado_em),
    }


def _limite(request: HttpRequest) -> int:
    try:
        limite = int(request.GET.get("limit") or LIMITE_PADRAO)
    except (TypeError, ValueError):
        return LIMITE_PADRAO
    if limite <= 0:
        return LIMITE_PADRAO
    return min(limite, LIMITE_MAXIMO)


@app_permissions_required("processos.view_processo", "prazos.view_prazo")
def listar_auditoria(request: HttpRequest):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    usuario_atual = _current_usuario(request)
    if not _is_admin(request, usuario_atual):
        return resposta_erro(
            {"permissao": ["Apenas administradores acessam a auditoria."]}, status=403
        )

    registros = RegistroAuditoria.objects.all()

    entidade_tipo = request.GET.get("entidade_tipo")
    if entidade_tipo:
        registros = registros.filter(entidade_tipo=entidade_tipo)

    entidade_id = request.GET.get("entidade_id")
    if entidade_id:
        registros = registros.filter(entidade_id=str(entidade_id))

    registros = registros[: _limite(request)]
    return resposta_sucesso(
        {"registros": [serialize_registro(registro) for registro in registros]}
    )
