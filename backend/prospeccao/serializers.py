from core.utils import isoformat_ou_nulo

from .models import InteracaoProspect, Prospect

def _total_interacoes(prospect: Prospect) -> int:
    # ``num_interacoes`` comes from ``.annotate(Count("interacoes"))`` on list queries.
    anotado = getattr(prospect, "num_interacoes", None)
    return anotado if anotado is not None else prospect.interacoes.count()


def serialize_interacao(interacao: InteracaoProspect):
    return {
        "id": str(interacao.pk),
        "pk": interacao.pk,
        "prospect_id": str(interacao.prospect_id),
        "tipo": interacao.tipo,
        "descricao": interacao.descricao,
        "data": isoformat_ou_nulo(interacao.data),
        "usuario_id": str(interacao.usuario_id) if interacao.usuario_id else "",
        "usuario_nome": interacao.usuario.nome if interacao.usuario else "",
        "criado_em": isoformat_ou_nulo(interacao.criado_em),
    }


def serialize_prospect(prospect: Prospect, incluir_interacoes: bool = False):
    responsavel = prospect.responsavel_interno
    dados = {
        "id": str(prospect.pk),
        "pk": prospect.pk,
        "nome": prospect.nome,
        "telefone": prospect.telefone,
        "email": prospect.email,
        "origem_contato": prospect.origem_contato,
        "tipo_demanda_juridica": prospect.tipo_demanda_juridica,
        "descricao_caso": prospect.descricao_caso,
        "responsavel_id": str(responsavel.pk) if responsavel else "",
        "responsavel_nome": responsavel.nome if responsavel else "",
        "status_prospeccao": prospect.status_prospeccao,
        "prioridade": prospect.prioridade,
        "proxima_acao": prospect.proxima_acao,
        "observacoes": prospect.observacoes,
        "data_ultimo_contato": (
            prospect.data_ultimo_contato.isoformat()
            if prospect.data_ultimo_contato
            else ""
        ),
        "cliente_convertido_id": (
            str(prospect.cliente_convertido_id)
            if prospect.cliente_convertido_id
            else ""
        ),
        "convertido_em": isoformat_ou_nulo(prospect.convertido_em),
        "total_interacoes": _total_interacoes(prospect),
        "data_criacao": isoformat_ou_nulo(prospect.data_criacao),
        "atualizado_em": isoformat_ou_nulo(prospect.atualizado_em),
    }
    if incluir_interacoes:
        dados["interacoes"] = [
            serialize_interacao(interacao)
            for interacao in prospect.interacoes.select_related("usuario").all()
        ]
    return dados
