from core.utils import isoformat_ou_nulo
from prazos.models import Prazo


def serialize_prazo(prazo: Prazo):
    cliente = prazo.processo.cliente if prazo.processo_id else None
    return {
        "id": str(prazo.pk),
        "pk": prazo.pk,
        "titulo": prazo.titulo,
        "descricao": prazo.descricao,
        "data_limite": prazo.data_limite.isoformat() if prazo.data_limite else "",
        "status": prazo.status,
        "prioridade": prazo.prioridade,
        "cliente_id": str(cliente.pk) if cliente else "",
        "cliente_nome": cliente.nome if cliente else "",
        "processo_id": str(prazo.processo_id),
        "processo_numero": prazo.processo.numero_processo if prazo.processo_id else "",
        "responsavel": str(prazo.responsavel_id) if prazo.responsavel_id else "",
        "responsavel_nome": prazo.responsavel.nome if prazo.responsavel_id else "",
        "criado_por": prazo.criado_por,
        "observacoes": prazo.observacoes,
        "link_drive": prazo.link_drive,
        "drive_file_id": prazo.drive_file_id,
        "concluido": prazo.concluido,
        "tempo_decorrido_segundos": prazo.tempo_decorrido_segundos,
        "timer_iniciado_em": isoformat_ou_nulo(prazo.timer_iniciado_em),
        "criado_em": isoformat_ou_nulo(prazo.criado_em),
        "atualizado_em": isoformat_ou_nulo(prazo.atualizado_em),
    }
