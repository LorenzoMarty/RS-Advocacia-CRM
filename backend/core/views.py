from datetime import date

from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie

from agenda.models import Evento
from agenda.views import serialize_evento
from clientes.models import Cliente
from clientes.views import serialize_cliente
from core.permissions import app_permissions_required
from core.permission_utils import user_has_permission
from core.utils import method_not_allowed, success_response
from processos.models import Processo
from processos.views import serialize_processo
from usuarios.models import Usuario
from usuarios.views import serialize_cargo, serialize_permission_groups, serialize_usuario, _get_cargos


@app_permissions_required(
    "agenda.view_evento",
    "clientes.view_cliente",
    "processos.view_processo",
)
def dashboard(request):
    if request.method != "GET":
        return method_not_allowed(["GET"])

    hoje = date.today()
    eventos_hoje = Evento.objects.filter(data_inicio__date=hoje).select_related("cliente", "processo")
    proximos_eventos = (
        Evento.objects.filter(data_inicio__date__gte=hoje)
        .select_related("cliente", "processo")
        .order_by("data_inicio")[:5]
    )

    return success_response(
        {
            "eventos_hoje": [serialize_evento(evento) for evento in eventos_hoje],
            "proximos_eventos": [serialize_evento(evento) for evento in proximos_eventos],
            "total_clientes": Cliente.objects.count(),
            "total_processos": Processo.objects.count(),
        }
    )


@app_permissions_required(
    "agenda.view_evento",
    "clientes.view_cliente",
    "processos.view_processo",
)
def bootstrap(request):
    if request.method != "GET":
        return method_not_allowed(["GET"])

    clientes = Cliente.objects.all()
    processos = Processo.objects.select_related("cliente").all()
    eventos = Evento.objects.select_related("cliente", "processo").all()
    serialized_clientes = [serialize_cliente(cliente) for cliente in clientes]
    serialized_processos = [serialize_processo(processo) for processo in processos]
    serialized_eventos = [serialize_evento(evento) for evento in eventos]

    data = {
        "clientes": serialized_clientes,
        "clients": serialized_clientes,
        "processos": serialized_processos,
        "processes": serialized_processos,
        "eventos": serialized_eventos,
        "events": serialized_eventos,
        "permissionGroups": serialize_permission_groups(),
    }

    if user_has_permission(request, "usuarios.view_usuario"):
        usuarios = Usuario.objects.all()
        serialized_usuarios = [serialize_usuario(usuario) for usuario in usuarios]
        data["usuarios"] = serialized_usuarios
        data["users"] = serialized_usuarios

    if user_has_permission(request, "auth.view_group"):
        cargos = _get_cargos()
        serialized_cargos = [serialize_cargo(cargo) for cargo in cargos]
        data["cargos"] = serialized_cargos
        data["roles"] = serialized_cargos

    return success_response(data)


@ensure_csrf_cookie
def csrf_token(request):
    if request.method != "GET":
        return method_not_allowed(["GET"])

    return success_response({"csrfToken": get_token(request)})
