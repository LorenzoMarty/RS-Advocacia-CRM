from auditoria.models import RegistroAuditoria
from core.utils import isoformat_ou_nulo
from peticoes.models import Peticao
from prazos.models import Prazo


def serialize_registro(registro: RegistroAuditoria):
    processo_id = registro.processo_id or ""
    processo_rotulo = registro.processo_rotulo or ""

    if not processo_id:
        if registro.entidade_tipo == RegistroAuditoria.ENTIDADE_PROCESSO:
            processo_id = registro.entidade_id
            processo_rotulo = registro.entidade_rotulo
        elif registro.entidade_tipo == RegistroAuditoria.ENTIDADE_PRAZO:
            prazo = (
                Prazo.objects.select_related("processo", "responsavel")
                .filter(pk=registro.entidade_id)
                .first()
            )
            if prazo and prazo.processo_id:
                processo_id = str(prazo.processo_id)
                processo_rotulo = prazo.processo.numero_processo
        elif registro.entidade_tipo == RegistroAuditoria.ENTIDADE_PETICAO:
            peticao = (
                Peticao.objects.select_related("processo")
                .filter(pk=registro.entidade_id)
                .first()
            )
            if peticao and peticao.processo_id:
                processo_id = str(peticao.processo_id)
                processo_rotulo = peticao.processo.numero_processo

    return {
        "id": str(registro.pk),
        "pk": registro.pk,
        "acao": registro.acao,
        "entidade_tipo": registro.entidade_tipo,
        "entidade_id": registro.entidade_id,
        "entidade_rotulo": registro.entidade_rotulo,
        "autor_nome": registro.autor_nome,
        "resumo": registro.resumo,
        "alteracoes": registro.alteracoes,
        "processo_id": processo_id,
        "processo_numero": processo_rotulo,
        "criado_em": isoformat_ou_nulo(registro.criado_em),
    }
