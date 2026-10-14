"""Global search (⌘K): a few matches per entity type, honouring view permissions."""

from django.db.models import Q

from agenda.models import Evento
from clientes.models import Cliente
from core.permission_utils import user_has_permission
from core.permissions import app_permissions_required
from core.utils import metodo_nao_permitido, resposta_sucesso
from peticoes.models import Peticao
from prazos.models import Prazo
from processos.models import Processo

MIN_QUERY_LENGTH = 2
LIMITE_POR_GRUPO = 4


def _grupo(queryset, titulo, meta=None):
    return [
        {
            "id": str(obj.pk),
            "titulo": titulo(obj),
            "meta": meta(obj) if meta else "",
        }
        for obj in queryset[:LIMITE_POR_GRUPO]
    ]


@app_permissions_required()
def busca_global(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    termo = request.GET.get("q", "").strip()
    grupos = {}
    if len(termo) >= MIN_QUERY_LENGTH:
        if user_has_permission(request, "clientes.view_cliente"):
            clientes = Cliente.objects.filter(
                Q(nome__icontains=termo) | Q(email__icontains=termo)
            ).order_by("nome")
            grupos["clientes"] = _grupo(clientes, lambda c: c.nome)
        if user_has_permission(request, "processos.view_processo"):
            processos = Processo.objects.filter(
                Q(numero_processo__icontains=termo) | Q(descricao__icontains=termo)
            ).order_by("numero_processo")
            grupos["processos"] = _grupo(
                processos, lambda p: p.numero_processo, lambda p: p.descricao
            )
        if user_has_permission(request, "prazos.view_prazo"):
            prazos = Prazo.objects.filter(titulo__icontains=termo)
            grupos["prazos"] = _grupo(prazos, lambda p: p.titulo)
        if user_has_permission(request, "agenda.view_evento"):
            eventos = Evento.objects.exclude(tipo_evento__icontains="prazo").filter(
                titulo__icontains=termo
            ).order_by("data_inicio", "id")
            grupos["eventos"] = _grupo(eventos, lambda e: e.titulo)
        if user_has_permission(request, "peticoes.view_peticao"):
            peticoes = (
                Peticao.objects.select_related("cliente")
                .filter(Q(cliente__nome__icontains=termo) | Q(adverso__icontains=termo))
            )
            grupos["peticoes"] = _grupo(
                peticoes, lambda p: p.cliente.nome or p.adverso, lambda p: p.adverso
            )

    return resposta_sucesso({"q": termo, "grupos": grupos})
