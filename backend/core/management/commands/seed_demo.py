from django.core.management.base import BaseCommand
from django.db import transaction

from agenda.models import Evento
from clientes.models import Cliente
from core.demo_data import seed_demo_data
from financeiro.models import Lancamento
from meetings.models import Gravacao, Reuniao
from prazos.models import Prazo
from processos.models import Processo
from productivity.models import ProductivityGoal, TimeEntry
from prospeccao.models import Prospect
from usuarios.models import Usuario


class Command(BaseCommand):
    help = (
        "Insere os dados demo no banco (one-shot). Ignora DEMO_DATA_ENABLED. "
        "Idempotente: pode rodar mais de uma vez sem duplicar."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Roda dentro de uma transação e reverte no fim (apenas previsão).",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        mode = "DRY-RUN" if dry_run else "WRITE"
        self.stdout.write(f"{mode}: semeando dados demo...")

        with transaction.atomic():
            usuario, _ = seed_demo_data()
            counts = {
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

        for nome, total in counts.items():
            self.stdout.write(f"  {nome}: {total}")
        self.stdout.write(f"Usuário admin demo: {usuario.email}")
        if dry_run:
            self.stdout.write("Dry-run: nada foi persistido. Rode sem --dry-run para aplicar.")
        else:
            self.stdout.write(f"{mode}: dados demo inseridos.")
