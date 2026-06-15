from django.core.management.base import BaseCommand
from django.db import connection

from peticoes.models import Peticao


class Command(BaseCommand):
    help = (
        "Lista petições sem processo vinculado. Rode ANTES de aplicar a migration "
        "0005 (que remove a coluna area_juridica): a área dessas petições se perde "
        "ao dropar a coluna, então elas precisam de um processo atribuído manualmente."
    )

    def handle(self, *args, **options):
        # Lê area_juridica direto da coluna (o model já não tem o campo). Se a
        # coluna não existir mais (migration aplicada), segue sem ela.
        table = Peticao._meta.db_table
        colunas = {c.name for c in connection.introspection.get_table_description(
            connection.cursor(), table
        )}
        tem_area = "area_juridica" in colunas

        peticoes = (
            Peticao.objects.filter(processo__isnull=True)
            .select_related("cliente")
            .order_by("cliente__nome", "adverso")
        )

        areas = {}
        if tem_area:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"SELECT id, area_juridica FROM {table} WHERE processo_id IS NULL"
                )
                areas = {row[0]: row[1] for row in cursor.fetchall()}

        total = peticoes.count()
        if not total:
            self.stdout.write(self.style.SUCCESS("Nenhuma petição sem processo. OK para migrar."))
            return

        self.stdout.write(
            self.style.WARNING(f"{total} petição(ões) sem processo vinculado:")
        )
        for peticao in peticoes:
            area = areas.get(peticao.pk, "") if tem_area else "(coluna já removida)"
            cliente = peticao.cliente.nome if peticao.cliente_id else "?"
            self.stdout.write(
                f"  #{peticao.pk}  cliente={cliente!r}  adverso={peticao.adverso!r}  "
                f"area_juridica={area!r}"
            )
        self.stdout.write(
            self.style.WARNING(
                "Atribua um processo a cada uma antes de aplicar a migration 0005."
            )
        )
