from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import OperationalError, connection, transaction

from usuarios.models import Usuario
from usuarios.views import _ensure_default_cargos, _find_auth_user, _sync_usuario_auth


class Command(BaseCommand):
    help = "Sincroniza cargos, grupos/permissoes padrao e grupos dos auth users."

    def add_arguments(self, parser):
        parser.add_argument(
            "--write",
            action="store_true",
            help="Persiste as alteracoes. Sem esta flag, roda em dry-run e reverte tudo.",
        )
        parser.add_argument(
            "--connect-timeout",
            default=15,
            type=int,
            help="Timeout da conexao com o banco, em segundos. Padrao: 15.",
        )
        parser.add_argument(
            "--progress-every",
            default=25,
            type=int,
            help="Mostra progresso a cada N usuarios. Padrao: 25.",
        )
        parser.add_argument(
            "--sslmode",
            default="require",
            help=(
                "sslmode para conexoes PostgreSQL. Padrao: require. "
                "Use disable apenas para banco local sem SSL."
            ),
        )

    def handle(self, *args, **options):
        write = options["write"]
        connect_timeout = options["connect_timeout"]
        progress_every = options["progress_every"]
        sslmode = options["sslmode"]
        stats = {
            "usuarios": 0,
            "auth_criados": 0,
            "cargos_normalizados": 0,
            "grupos_atualizados": 0,
        }

        mode = "WRITE" if write else "DRY-RUN"
        self._write(f"{mode}: iniciando sync_cargos.")
        if not write:
            self._write("Dry-run ativo: nenhuma alteracao sera persistida.")

        self._configure_connection_options(connect_timeout, sslmode)
        self._write(
            f"Conectando no banco {self._database_target()} "
            f"com timeout de {connect_timeout}s..."
        )
        try:
            connection.ensure_connection()
        except OperationalError as exc:
            raise CommandError(
                "Nao consegui conectar ao banco. "
                "Verifique rede/VPN/firewall, DATABASE_URL e se o host/porta do "
                "Supabase esta acessivel a partir desta maquina. "
                f"Erro original: {exc}"
            ) from exc
        self._write("Conexao aberta. Sincronizando cargos e usuarios...")

        with transaction.atomic():
            _ensure_default_cargos()

            usuarios = Usuario.objects.order_by("email", "pk")
            total = usuarios.count()
            self._write(f"Usuarios encontrados: {total}")

            for usuario in usuarios.iterator():
                stats["usuarios"] += 1
                before_cargo = usuario.cargo
                before_auth_user = _find_auth_user(usuario.email)
                before_groups = self._group_names(before_auth_user)

                auth_user = _sync_usuario_auth(usuario)
                usuario.refresh_from_db(fields=["cargo"])
                after_groups = self._group_names(auth_user)

                if before_auth_user is None:
                    stats["auth_criados"] += 1
                if usuario.cargo != before_cargo:
                    stats["cargos_normalizados"] += 1
                if after_groups != before_groups:
                    stats["grupos_atualizados"] += 1
                if progress_every > 0 and stats["usuarios"] % progress_every == 0:
                    self._write(f"Processados {stats['usuarios']}/{total} usuarios...")

            if not write:
                transaction.set_rollback(True)

        self._write(f"{mode}: sync_cargos finalizado.")
        self._write(f"Usuarios processados: {stats['usuarios']}")
        self._write(f"Auth users criados: {stats['auth_criados']}")
        self._write(f"Cargos normalizados: {stats['cargos_normalizados']}")
        self._write(f"Auth groups atualizados: {stats['grupos_atualizados']}")
        if not write:
            self._write("Nada foi persistido. Rode com --write para aplicar.")

    def _group_names(self, auth_user: User | None) -> set[str]:
        if auth_user is None or auth_user.pk is None:
            return set()
        return set(auth_user.groups.values_list("name", flat=True))

    def _configure_connection_options(
        self, connect_timeout: int, sslmode: str | None
    ) -> None:
        options = connection.settings_dict.setdefault("OPTIONS", {})
        if connect_timeout > 0:
            options.setdefault("connect_timeout", connect_timeout)
        if self._is_postgresql() and sslmode:
            options.setdefault("sslmode", sslmode)

    def _write(self, message: str) -> None:
        self.stdout.write(message)
        self.stdout.flush()

    def _database_target(self) -> str:
        host = connection.settings_dict.get("HOST") or "<host via DATABASE_URL>"
        port = connection.settings_dict.get("PORT") or "<porta padrao>"
        name = connection.settings_dict.get("NAME") or "<database>"
        return f"{host}:{port}/{name}"

    def _is_postgresql(self) -> bool:
        return "postgresql" in str(connection.settings_dict.get("ENGINE", ""))
