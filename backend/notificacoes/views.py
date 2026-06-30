from core.permissions import app_permissions_required
from core.utils import metodo_nao_permitido, resposta_erro, resposta_sucesso
from integrations.google.oauth import current_usuario

from .models import Notificacao


def _serialize_notificacao(n):
    return {
        "id": n.pk,
        "tipo": n.tipo,
        "titulo": n.titulo,
        "mensagem": n.mensagem,
        "link": n.link,
        "lida": n.lida,
        "criada_em": n.criada_em.isoformat(),
    }


@app_permissions_required()
def listar_notificacoes(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    usuario = current_usuario(request)
    if usuario is None:
        return resposta_erro({"autenticacao": ["Usuário da sessão não encontrado."]}, status=401)

    qs = Notificacao.objects.filter(
        usuario=usuario, lida=False
    ).order_by("-criada_em")[:50]

    itens = [_serialize_notificacao(n) for n in qs]
    total_nao_lidas = Notificacao.objects.filter(
        usuario=usuario, lida=False
    ).count()

    return resposta_sucesso({"itens": itens, "total_nao_lidas": total_nao_lidas})


@app_permissions_required()
def marcar_lida(request, notificacao_id):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    usuario = current_usuario(request)
    if usuario is None:
        return resposta_erro({"autenticacao": ["Usuário da sessão não encontrado."]}, status=401)

    try:
        n = Notificacao.objects.get(pk=notificacao_id, usuario=usuario)
    except Notificacao.DoesNotExist:
        return resposta_erro({"detalhe": "Notificação não encontrada."}, status=404)

    n.lida = True
    n.save(update_fields=["lida"])
    return resposta_sucesso(_serialize_notificacao(n))


@app_permissions_required()
def marcar_todas_lidas(request):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    usuario = current_usuario(request)
    if usuario is None:
        return resposta_erro({"autenticacao": ["Usuário da sessão não encontrado."]}, status=401)

    Notificacao.objects.filter(usuario=usuario, lida=False).update(lida=True)
    return resposta_sucesso({"marcadas": True})
