from core.utils import isoformat_ou_nulo
from processos.models import Processo


def serialize_processo(processo: Processo):
    cliente_nome = processo.cliente.nome if processo.cliente_id else ""
    return {
        "id": str(processo.pk),
        "pk": processo.pk,
        "numero_processo": processo.numero_processo,
        "cliente_id": str(processo.cliente_id),
        "cliente_nome": cliente_nome,
        "descricao": processo.descricao,
        "vara": processo.vara,
        "area_juridica": processo.area_juridica,
        "status": processo.status,
        "advogado_responsavel": (
            str(processo.advogado_responsavel_id)
            if processo.advogado_responsavel_id
            else ""
        ),
        "advogado_responsavel_nome": (
            processo.advogado_responsavel.nome
            if processo.advogado_responsavel_id
            else ""
        ),
        "advogado_habilitado": processo.advogado_habilitado,
        "data_ultima_movimentacao": isoformat_ou_nulo(
            processo.data_ultima_movimentacao
        ),
    }
