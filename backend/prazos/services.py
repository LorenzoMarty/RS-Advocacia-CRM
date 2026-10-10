"""Regras do cronômetro de prazos, independentes de HTTP."""

from django.utils import timezone
from django.utils.dateparse import parse_datetime

from prazos.models import Prazo

STATUS_EM_ANDAMENTO = "Em andamento"


class TimerInvalido(ValueError):
    """Payload do cronômetro inválido; ``campo`` identifica o campo com erro."""

    def __init__(self, campo: str, mensagem: str):
        super().__init__(mensagem)
        self.campo = campo
        self.mensagem = mensagem


def segundos_decorridos(prazo: Prazo, now=None) -> int:
    acumulado = int(prazo.tempo_decorrido_segundos or 0)
    if not prazo.timer_iniciado_em:
        return acumulado

    now = now or timezone.now()
    return acumulado + max(0, int((now - prazo.timer_iniciado_em).total_seconds()))


def _status_pendente(status: str) -> bool:
    return (status or "").strip().casefold() in {"pendente", "a fazer"}


def atualizar_timer(prazo: Prazo, payload: dict) -> Prazo:
    """Aplica ``tempo_decorrido_segundos`` e/ou ``timer_iniciado_em`` e salva.

    O tempo acumulado nunca diminui. Iniciar o timer de um prazo pendente e não
    concluído move o status para "Em andamento". Levanta ``TimerInvalido`` sem
    gravar nada se algum campo for inválido.
    """
    update_fields = ["atualizado_em"]
    atual = segundos_decorridos(prazo)

    if "tempo_decorrido_segundos" in payload:
        try:
            informado = int(payload.get("tempo_decorrido_segundos") or 0)
        except (TypeError, ValueError):
            raise TimerInvalido(
                "tempo_decorrido_segundos", "Informe um numero inteiro."
            ) from None
        if informado < 0:
            raise TimerInvalido(
                "tempo_decorrido_segundos", "O tempo não pode ser negativo."
            )
        prazo.tempo_decorrido_segundos = max(
            int(prazo.tempo_decorrido_segundos or 0), atual, informado
        )
        update_fields.append("tempo_decorrido_segundos")

    if "timer_iniciado_em" in payload:
        valor = payload.get("timer_iniciado_em")
        if valor in ("", None):
            prazo.timer_iniciado_em = None
        elif isinstance(valor, str):
            iniciado = parse_datetime(valor)
            if iniciado is None:
                raise TimerInvalido(
                    "timer_iniciado_em", "Informe uma data/hora valida."
                )
            if timezone.is_naive(iniciado):
                iniciado = timezone.make_aware(iniciado)
            prazo.timer_iniciado_em = iniciado
            if not prazo.concluido and _status_pendente(prazo.status):
                prazo.status = STATUS_EM_ANDAMENTO
                update_fields.append("status")
        else:
            raise TimerInvalido("timer_iniciado_em", "Informe uma data/hora valida.")
        update_fields.append("timer_iniciado_em")

    prazo.save(update_fields=update_fields)
    return prazo
