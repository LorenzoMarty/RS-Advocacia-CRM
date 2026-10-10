from core.utils import isoformat_ou_nulo
from peticoes.models import Peticao


def serialize_peticao(peticao: Peticao):
    return {
        "id": str(peticao.pk),
        "pk": peticao.pk,
        "cliente_id": str(peticao.cliente_id),
        "cliente_nome": peticao.cliente.nome if peticao.cliente_id else "",
        "processo_id": str(peticao.processo_id) if peticao.processo_id else "",
        "processo_numero": (
            peticao.processo.numero_processo if peticao.processo else ""
        ),
        "tipo": peticao.tipo,
        "adverso": peticao.adverso,
        "responsavel_acao": peticao.responsavel_acao,
        "link_drive": peticao.link_drive,
        "drive_file_id": peticao.drive_file_id,
        "motivo_pendente": peticao.motivo_pendente,
        "area_juridica": (
            peticao.processo.area_juridica if peticao.processo else ""
        ),
        "status": peticao.status,
        "criado_por": peticao.criado_por,
        "criado_em": isoformat_ou_nulo(peticao.criado_em),
        "atualizado_em": isoformat_ou_nulo(peticao.atualizado_em),
    }
