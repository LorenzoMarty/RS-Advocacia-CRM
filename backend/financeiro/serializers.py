from core.utils import isoformat_ou_nulo

from .models import Lancamento


def serialize_lancamento(lancamento: Lancamento):
    cliente = lancamento.cliente_relacionado
    caso = lancamento.caso_relacionado
    return {
        "id": str(lancamento.pk),
        "pk": lancamento.pk,
        "descricao": lancamento.descricao,
        "tipo": lancamento.tipo,
        "categoria": lancamento.categoria,
        "valor": str(lancamento.valor),
        "data_vencimento": (
            lancamento.data_vencimento.isoformat() if lancamento.data_vencimento else ""
        ),
        "data_pagamento": (
            lancamento.data_pagamento.isoformat() if lancamento.data_pagamento else ""
        ),
        "status": lancamento.status,
        "status_exibicao": lancamento.status_exibicao,
        "atrasado": lancamento.atrasado,
        "cliente_id": str(cliente.pk) if cliente else "",
        "cliente_nome": cliente.nome if cliente else "",
        "caso_id": str(caso.pk) if caso else "",
        "caso_numero": caso.numero_processo if caso else "",
        "observacoes": lancamento.observacoes,
        "criado_em": isoformat_ou_nulo(lancamento.criado_em),
        "atualizado_em": isoformat_ou_nulo(lancamento.atualizado_em),
    }
