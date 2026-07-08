from django.core.management.base import BaseCommand
from django.db import transaction

from agenda.models import Evento
from clientes.models import Cliente
from integrations.google.calendar import SYNC_CLIENT_NAME, SYNC_PROCESS_NUMBER
from processos.models import Processo


class Command(BaseCommand):
    """Remove o cliente/processo tecnico sintetico usado ate 2026-07 pelo sync
    do Google Calendar para abrigar eventos importados sem correspondencia local.

    Antes da mudanca em integrations/google/calendar.py (_create_imported_event),
    todo evento importado do Google sem par local era preso a um cliente
    ("Google Agenda") e processo ("GOOGLE-CALENDAR") sinteticos. Isso fazia esse
    cliente aparecer como um cliente real na listagem e acumular dezenas de
    compromissos sem nenhuma relacao real com ele.

    Por padrao roda em modo relatorio (nada e gravado). Use --aplicar para
    de fato soltar os eventos (cliente=None, processo=None) e apagar o
    cliente/processo sintetico.

    Como o cliente sintetico aparecia como um cliente normal na tela, e
    teoricamente possivel que alguem tenha cadastrado processos, documentos,
    peticoes ou prazos reais nele por engano. Por seguranca, o comando
    verifica isso antes de apagar e se recusa a prosseguir (mesmo com
    --aplicar) se encontrar qualquer coisa alem dos eventos de sync presos a
    ele - nesse caso e preciso revisar manualmente antes.
    """

    help = (
        "Limpa o cliente/processo tecnico sintetico ('Google Agenda' / "
        "'GOOGLE-CALENDAR') criado pelo sync antigo do Google Calendar. "
        "Por padrao so mostra um relatorio; use --aplicar para executar."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--aplicar",
            action="store_true",
            help="Executa a limpeza de fato. Sem essa flag, so mostra o relatorio.",
        )

    def handle(self, *args, **options):
        aplicar = options["aplicar"]

        processos = Processo.objects.filter(numero_processo=SYNC_PROCESS_NUMBER)
        clientes = Cliente.objects.filter(nome=SYNC_CLIENT_NAME)

        if not processos.exists() and not clientes.exists():
            self.stdout.write(
                self.style.SUCCESS(
                    "Nenhum cliente/processo tecnico sintetico encontrado. "
                    "Nada a fazer."
                )
            )
            return

        self.stdout.write(
            f"Cliente(s) sintetico(s) (nome='{SYNC_CLIENT_NAME}'): {clientes.count()}"
        )
        self.stdout.write(
            f"Processo(s) sintetico(s) (numero_processo='{SYNC_PROCESS_NUMBER}'): "
            f"{processos.count()}"
        )

        eventos_presos = Evento.objects.filter(
            cliente__in=clientes
        ) | Evento.objects.filter(processo__in=processos)
        eventos_presos = eventos_presos.distinct()
        self.stdout.write(f"Eventos de sync presos a eles: {eventos_presos.count()}")

        # Verifica se existe algo alem dos eventos de sync grudado no
        # cliente/processo sintetico. Como esse cliente aparecia como um
        # cliente normal na tela, alguem pode ter cadastrado dados reais nele
        # por engano - nesse caso NAO apagamos automaticamente.
        outros_processos = Processo.objects.filter(cliente__in=clientes).exclude(
            numero_processo=SYNC_PROCESS_NUMBER
        )

        achados_de_risco = {
            "outros processos do cliente sintetico": outros_processos.count(),
            "documentos (DocumentoCliente) do cliente sintetico": _count(
                "documentos", "DocumentoCliente", cliente__in=clientes
            ),
            "peticoes do cliente sintetico": _count(
                "peticoes", "Peticao", cliente__in=clientes
            ),
            "prazos do processo sintetico": _count(
                "prazos", "Prazo", processo__in=processos
            ),
            "reunioes (meetings) do cliente sintetico": _count(
                "meetings", "Reuniao", cliente__in=clientes
            ),
        }
        achados_de_risco = {k: v for k, v in achados_de_risco.items() if v}

        if achados_de_risco:
            self.stdout.write(
                self.style.ERROR(
                    "Encontrados registros REAIS presos ao cliente/processo "
                    "sintetico - a limpeza automatica foi abortada. Revise "
                    "manualmente antes de prosseguir:"
                )
            )
            for descricao, quantidade in achados_de_risco.items():
                self.stdout.write(f"  - {descricao}: {quantidade}")
            return

        if not aplicar:
            self.stdout.write(
                self.style.WARNING(
                    "Modo relatorio (nenhuma alteracao gravada). Rode com "
                    "--aplicar para executar a limpeza."
                )
            )
            return

        with transaction.atomic():
            # Solta os eventos primeiro: os FKs cliente/processo em Evento sao
            # CASCADE, entao apagar o Processo/Cliente antes disso apagaria os
            # eventos junto.
            atualizados = eventos_presos.update(cliente=None, processo=None)
            _, detalhe_processos = processos.delete()
            _, detalhe_clientes = clientes.delete()

        self.stdout.write(
            self.style.SUCCESS(
                f"Eventos soltos (cliente=None, processo=None): {atualizados}. "
                f"Registros removidos junto ao(s) processo(s) sintetico(s): "
                f"{detalhe_processos}. "
                f"Registros removidos junto ao(s) cliente(s) sintetico(s): "
                f"{detalhe_clientes}."
            )
        )


def _count(app_label, model_name, **filtro):
    """Conta registros de um model por nome, sem forcar import direto (evita
    dependencia circular e permite rodar mesmo se o app nao existir)."""
    from django.apps import apps

    try:
        model = apps.get_model(app_label, model_name)
    except LookupError:
        return 0
    return model.objects.filter(**filtro).count()
