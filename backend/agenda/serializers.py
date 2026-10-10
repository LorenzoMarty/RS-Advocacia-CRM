from agenda.models import Evento
from core.utils import isoformat_ou_nulo


def serialize_evento(evento: Evento):
    cliente_nome = evento.cliente.nome if evento.cliente_id else ""
    processo_numero = evento.processo.numero_processo if evento.processo_id else ""
    responsavel_nome = evento.responsavel.nome if evento.responsavel_id else ""
    return {
        "id": str(evento.pk),
        "pk": evento.pk,
        "titulo": evento.titulo,
        "descricao": evento.descricao,
        "data_inicio": isoformat_ou_nulo(evento.data_inicio),
        "data_fim": isoformat_ou_nulo(evento.data_fim),
        "tipo_evento": evento.tipo_evento,
        "status": evento.status,
        "prioridade": evento.prioridade,
        "cliente_id": str(evento.cliente_id) if evento.cliente_id else "",
        "cliente_nome": cliente_nome,
        "processo_id": str(evento.processo_id) if evento.processo_id else "",
        "processo_numero": processo_numero,
        "responsavel": str(evento.responsavel_id) if evento.responsavel_id else "",
        "responsavel_nome": responsavel_nome,
        "criado_por": evento.criado_por,
        "local": evento.local,
        "observacoes": evento.observacoes,
        "lembrete_em": isoformat_ou_nulo(evento.lembrete_em),
        "concluido": evento.concluido,
    }
