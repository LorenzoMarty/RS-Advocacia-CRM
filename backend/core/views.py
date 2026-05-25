from datetime import date

from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie

from agenda.models import Evento
from agenda.views import serialize_evento
from clientes.models import Cliente
from clientes.views import serialize_cliente
from core.permissions import app_permissions_required
from core.permission_utils import user_has_any_permissions, user_has_permission
from core.utils import metodo_nao_permitido, resposta_sucesso
from processos.models import Processo
from processos.views import serialize_processo
from peticoes.models import Peticao
from peticoes.views import serialize_peticao
from prazos.models import Prazo
from prazos.views import serialize_prazo
from usuarios.models import Usuario
from usuarios.views import (
    CARGO_LIST_PERMISSIONS,
    serialize_cargo,
    serialize_permission_groups,
    serialize_usuarios,
    _get_cargos,
)


@app_permissions_required(
    "agenda.view_evento",
    "peticoes.view_peticao",
    "prazos.view_prazo",
    "clientes.view_cliente",
    "processos.view_processo",
)
def painel(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    hoje = date.today()
    eventos_hoje = (
        Evento.objects.exclude(tipo_evento__icontains="prazo")
        .filter(data_inicio__date=hoje)
        .select_related("cliente", "processo")
    )
    prazos_hoje = Prazo.objects.filter(data_limite=hoje).select_related("processo__cliente")
    proximos_eventos = (
        Evento.objects.exclude(tipo_evento__icontains="prazo")
        .filter(data_inicio__date__gte=hoje)
        .select_related("cliente", "processo")
        .order_by("data_inicio")[:5]
    )
    proximos_prazos = (
        Prazo.objects.filter(data_limite__gte=hoje)
        .select_related("processo__cliente")
        .order_by("data_limite")[:5]
    )

    return resposta_sucesso(
        {
            "eventos_hoje": [serialize_evento(evento) for evento in eventos_hoje],
            "prazos_hoje": [serialize_prazo(prazo) for prazo in prazos_hoje],
            "proximos_eventos": [serialize_evento(evento) for evento in proximos_eventos],
            "proximos_prazos": [serialize_prazo(prazo) for prazo in proximos_prazos],
            "total_clientes": Cliente.objects.count(),
            "total_processos": Processo.objects.count(),
            "total_peticoes": Peticao.objects.count(),
            "total_prazos": Prazo.objects.count(),
        }
    )


@app_permissions_required(
    "agenda.view_evento",
    "peticoes.view_peticao",
    "prazos.view_prazo",
    "clientes.view_cliente",
    "processos.view_processo",
)
def inicializacao(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    clientes = Cliente.objects.all()
    processos = Processo.objects.select_related("cliente").all()
    eventos = (
        Evento.objects.exclude(tipo_evento__icontains="prazo")
        .select_related("cliente", "processo")
        .all()
    )
    peticoes = Peticao.objects.select_related("cliente").all()
    prazos = Prazo.objects.select_related("processo__cliente").all()
    serialized_clientes = [serialize_cliente(cliente) for cliente in clientes]
    serialized_processos = [serialize_processo(processo) for processo in processos]
    serialized_eventos = [serialize_evento(evento) for evento in eventos]
    serialized_peticoes = [serialize_peticao(peticao) for peticao in peticoes]
    serialized_prazos = [serialize_prazo(prazo) for prazo in prazos]

    can_include_cargos = user_has_any_permissions(request, CARGO_LIST_PERMISSIONS)
    serialized_cargos = []
    if can_include_cargos:
        cargos = _get_cargos()
        serialized_cargos = [serialize_cargo(cargo) for cargo in cargos]

    data = {
        "clientes": serialized_clientes,
        "processos": serialized_processos,
        "eventos": serialized_eventos,
        "peticoes": serialized_peticoes,
        "prazos": serialized_prazos,
        "grupos_permissoes": serialize_permission_groups(),
    }

    if user_has_permission(request, "usuarios.view_usuario"):
        serialized_usuarios = serialize_usuarios(Usuario.objects.all())
        data["usuarios"] = serialized_usuarios

    if can_include_cargos:
        data["cargos"] = serialized_cargos

    return resposta_sucesso(data)


@ensure_csrf_cookie
def csrf_token(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    return resposta_sucesso({"csrf_token": get_token(request)}, mensagem="Token CSRF definido.")
