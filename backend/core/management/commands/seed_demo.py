from django.core.management.base import BaseCommand
from django.db import transaction

from agenda.models import Evento
from clientes.models import Cliente
from core.demo_data import bulk_demo_data, seed_demo_data
from financeiro.models import Lancamento
from meetings.models import Gravacao, Reuniao
from prazos.models import Prazo
from processos.models import Processo
from productivity.models import ProductivityGoal, TimeEntry
from prospeccao.models import Prospect
from usuarios.models import Usuario


class Command(BaseCommand):
    help = (
        "Insere dados demo no banco (one-shot). Ignora DEMO_DATA_ENABLED. "
        "Sem --bulk: seed base idempotente. Com --bulk N: insere N lotes NOVOS "
        "(create() puro, não toca no que já existe) — para 'encher' o banco."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Roda dentro de uma transação e reverte no fim (apenas previsão).",
        )
        parser.add_argument(
            "--bulk",
            type=int,
            default=0,
            metavar="N",
            help=(
                "Insere N lotes demo NOVOS e distintos (cliente+processo+eventos+"
                "prazo+prospect+lançamento) sem atualizar/apagar nada. Seguro em "
                "banco já populado. Sem esta flag, roda o seed base idempotente."
            ),
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        bulk = options["bulk"]
        mode = "DRY-RUN" if dry_run else "WRITE"

        with transaction.atomic():
            if bulk > 0:
                self.stdout.write(f"{mode}: inserindo {bulk} lote(s) demo (aditivo)...")
                criados = bulk_demo_data(bulk)
                self.stdout.write("Registros criados nesta execução:")
                for nome, total in criados.items():
                    self.stdout.write(f"  +{total} {nome}")
            else:
                self.stdout.write(f"{mode}: semeando dados demo base (idempotente)...")
                seed_demo_data()

            totais = {
                "usuarios": Usuario.objects.count(),
                "clientes": Cliente.objects.count(),
                "processos": Processo.objects.count(),
                "eventos": Evento.objects.count(),
                "prazos": Prazo.objects.count(),
                "prospects": Prospect.objects.count(),
                "lancamentos": Lancamento.objects.count(),
                "reunioes": Reuniao.objects.count(),
                "gravacoes": Gravacao.objects.count(),
                "metas_produtividade": ProductivityGoal.objects.count(),
                "time_entries": TimeEntry.objects.count(),
            }
            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write("Totais no banco agora:")
        for nome, total in totais.items():
            self.stdout.write(f"  {nome}: {total}")
        if dry_run:
            self.stdout.write("Dry-run: nada foi persistido. Rode sem --dry-run para aplicar.")
        else:
            self.stdout.write(f"{mode}: concluído.")
