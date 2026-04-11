from datetime import date, datetime, time, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from agenda.models import Evento
from clientes.models import Cliente
from processos.models import Processo
from usuarios.models import Usuario


class Command(BaseCommand):
    help = "Cria ou atualiza registros demo para desenvolvimento."

    def __init__(self):
        super().__init__()
        self.stats = {
            "clientes": {"created": 0, "updated": 0},
            "usuarios": {"created": 0, "updated": 0},
            "processos": {"created": 0, "updated": 0},
            "compromissos": {"created": 0, "updated": 0},
        }

    def handle(self, *args, **options):
        today = date.today()

        with transaction.atomic():
            usuarios = self.seed_usuarios()
            clientes = self.seed_clientes()
            processos = self.seed_processos(clientes)
            self.seed_eventos(today, clientes, processos, usuarios)

        self.stdout.write(self.style.SUCCESS("Registros demo aplicados com sucesso."))
        for label, values in self.stats.items():
            self.stdout.write(
                f"- {label}: {values['created']} criados, {values['updated']} atualizados"
            )

    def upsert(self, model, lookup, defaults, bucket):
        instance = model.objects.filter(**lookup).first()
        created = instance is None

        if created:
            instance = model(**lookup)

        for field, value in defaults.items():
            setattr(instance, field, value)

        instance.full_clean()
        instance.save()

        self.stats[bucket]["created" if created else "updated"] += 1
        return instance

    def make_dt(self, base_date, day_offset, hour, minute, duration_hours=1, duration_minutes=0):
        start = timezone.make_aware(
            datetime.combine(base_date + timedelta(days=day_offset), time(hour, minute))
        )
        end = start + timedelta(hours=duration_hours, minutes=duration_minutes)
        return start, end

    def seed_usuarios(self):
        usuarios = {}
        demo_usuarios = [
            {
                "nome": "Renata Soares",
                "email": "renata.soares.demo@rsadvocacia.local",
                "senha": "demo123",
                "cargo": "admin",
                "OAB": "SP-120045",
            },
            {
                "nome": "Gabriel Nunes",
                "email": "gabriel.nunes.demo@rsadvocacia.local",
                "senha": "demo123",
                "cargo": "advogado",
                "OAB": "SP-223410",
            },
            {
                "nome": "Larissa Prado",
                "email": "larissa.prado.demo@rsadvocacia.local",
                "senha": "demo123",
                "cargo": "advogado",
                "OAB": "SP-245901",
            },
            {
                "nome": "Bruno Lima",
                "email": "bruno.lima.demo@rsadvocacia.local",
                "senha": "demo123",
                "cargo": "Estagiário",
                "OAB": "",
            },
        ]

        for item in demo_usuarios:
            usuario = self.upsert(
                Usuario,
                {"email": item["email"]},
                {
                    "nome": item["nome"],
                    "senha": item["senha"],
                    "cargo": item["cargo"],
                    "OAB": item["OAB"],
                },
                "usuarios",
            )
            usuarios[item["nome"]] = usuario

        return usuarios

    def seed_clientes(self):
        clientes = {}
        demo_clientes = [
            {
                "nome": "Mariana Souza",
                "email": "mariana.souza.demo@example.com",
                "telefone": "(11) 99876-1001",
                "cpf": "123.456.789-10",
                "obs": "Cliente demo para agenda cível.",
            },
            {
                "nome": "TecVale Industria Ltda",
                "email": "contato.tecale.demo@example.com",
                "telefone": "(11) 4002-7010",
                "cpf": "12345678000190",
                "obs": "Conta empresarial demo.",
            },
            {
                "nome": "Carlos Ribeiro",
                "email": "carlos.ribeiro.demo@example.com",
                "telefone": "(21) 98877-2002",
                "cpf": "987.654.321-00",
                "obs": "Cliente demo com prazo próximo.",
            },
            {
                "nome": "Instituto Aurora",
                "email": "juridico.aurora.demo@example.com",
                "telefone": "(31) 3333-4040",
                "cpf": "45678900000111",
                "obs": "Cliente institucional para tarefas internas.",
            },
            {
                "nome": "Helena Martins",
                "email": "helena.martins.demo@example.com",
                "telefone": "(41) 99111-8080",
                "cpf": "456.123.789-55",
                "obs": "Cliente demo com audiência futura.",
            },
        ]

        for item in demo_clientes:
            cliente = self.upsert(
                Cliente,
                {"email": item["email"]},
                {
                    "nome": item["nome"],
                    "telefone": item["telefone"],
                    "cpf": item["cpf"],
                    "obs": item["obs"],
                },
                "clientes",
            )
            clientes[item["nome"]] = cliente

        return clientes

    def seed_processos(self, clientes):
        processos = {}
        demo_processos = [
            {
                "numero_processo": "PROC-2026-0001",
                "cliente": clientes["Mariana Souza"],
                "descricao": "Ação de indenização por danos materiais.",
                "vara": "12a Vara Cível de São Paulo",
                "area_juridica": "Cível",
                "status": "Em andamento",
                "advogado_responsavel": "Renata Soares",
            },
            {
                "numero_processo": "PROC-2026-0002",
                "cliente": clientes["TecVale Industria Ltda"],
                "descricao": "Reclamação trabalhista com fase de instrução.",
                "vara": "18a Vara do Trabalho de São Paulo",
                "area_juridica": "Trabalhista",
                "status": "Aguardando audiência",
                "advogado_responsavel": "Gabriel Nunes",
            },
            {
                "numero_processo": "PROC-2026-0003",
                "cliente": clientes["Carlos Ribeiro"],
                "descricao": "Cumprimento de sentença com prazo de manifestação.",
                "vara": "1a Vara Cível do Rio de Janeiro",
                "area_juridica": "Cível",
                "status": "Prazo aberto",
                "advogado_responsavel": "Larissa Prado",
            },
            {
                "numero_processo": "PROC-2026-0004",
                "cliente": clientes["Instituto Aurora"],
                "descricao": "Análise contratual e adequação documental.",
                "vara": "24a Vara Empresarial de Belo Horizonte",
                "area_juridica": "Empresarial",
                "status": "Fase inicial",
                "advogado_responsavel": "Renata Soares",
            },
            {
                "numero_processo": "PROC-2026-0005",
                "cliente": clientes["Helena Martins"],
                "descricao": "Ação de família com audiência já designada.",
                "vara": "1a Vara de Família de Curitiba",
                "area_juridica": "Família",
                "status": "Audiência marcada",
                "advogado_responsavel": "Gabriel Nunes",
            },
        ]

        for item in demo_processos:
            processo = self.upsert(
                Processo,
                {"numero_processo": item["numero_processo"]},
                {
                    "cliente": item["cliente"],
                    "descricao": item["descricao"],
                    "vara": item["vara"],
                    "area_juridica": item["area_juridica"],
                    "status": item["status"],
                    "advogado_responsavel": item["advogado_responsavel"],
                },
                "processos",
            )
            processos[item["numero_processo"]] = processo

        return processos

    def seed_eventos(self, today, clientes, processos, usuarios):
        demo_eventos = [
            {
                "titulo": "Audiência de conciliação",
                "cliente": clientes["Mariana Souza"],
                "processo": processos["PROC-2026-0001"],
                "tipo_evento": "Audiência",
                "status": "Confirmado",
                "prioridade": "Alta",
                "responsavel": usuarios["Renata Soares"].nome,
                "local": "Fórum Central - Sala 4",
                "descricao": "Sessão de conciliação com proposta inicial.",
                "observacoes": "Registro demo para o dashboard.",
                "day_offset": 0,
                "hour": 10,
                "minute": 0,
                "duration_hours": 2,
                "lembrete_horas": 24,
                "concluido": False,
            },
            {
                "titulo": "Reunião de estratégia trabalhista",
                "cliente": clientes["TecVale Industria Ltda"],
                "processo": processos["PROC-2026-0002"],
                "tipo_evento": "Reunião",
                "status": "Agendado",
                "prioridade": "Média",
                "responsavel": usuarios["Gabriel Nunes"].nome,
                "local": "Sala de reunião 2",
                "descricao": "Alinhamento com o cliente sobre provas e testemunhas.",
                "observacoes": "Registro demo para a lista de hoje.",
                "day_offset": 0,
                "hour": 15,
                "minute": 30,
                "duration_hours": 1,
                "duration_minutes": 30,
                "lembrete_horas": 3,
                "concluido": False,
            },
            {
                "titulo": "Prazo para contestação",
                "cliente": clientes["Carlos Ribeiro"],
                "processo": processos["PROC-2026-0003"],
                "tipo_evento": "Prazo",
                "status": "Aguardando",
                "prioridade": "Alta",
                "responsavel": usuarios["Larissa Prado"].nome,
                "local": "Portal e-SAJ",
                "descricao": "Protocolar contestação e anexar comprovantes.",
                "observacoes": "Registro demo para próximos compromissos.",
                "day_offset": 1,
                "hour": 17,
                "minute": 0,
                "duration_hours": 1,
                "lembrete_horas": 6,
                "concluido": False,
            },
            {
                "titulo": "Checklist documental",
                "cliente": clientes["Instituto Aurora"],
                "processo": processos["PROC-2026-0004"],
                "tipo_evento": "Tarefa interna",
                "status": "Agendado",
                "prioridade": "Baixa",
                "responsavel": usuarios["Bruno Lima"].nome,
                "local": "Backoffice",
                "descricao": "Conferir anexos e pendências cadastrais.",
                "observacoes": "Tarefa interna demo.",
                "day_offset": 2,
                "hour": 9,
                "minute": 0,
                "duration_hours": 2,
                "lembrete_horas": 12,
                "concluido": False,
            },
            {
                "titulo": "Audiência de instrução",
                "cliente": clientes["Helena Martins"],
                "processo": processos["PROC-2026-0005"],
                "tipo_evento": "Audiência",
                "status": "Confirmado",
                "prioridade": "Alta",
                "responsavel": usuarios["Gabriel Nunes"].nome,
                "local": "Fórum de Família - Sala 7",
                "descricao": "Oitiva das partes e definição de novos encaminhamentos.",
                "observacoes": "Audiência futura para alimentar o calendário.",
                "day_offset": 5,
                "hour": 13,
                "minute": 30,
                "duration_hours": 2,
                "lembrete_horas": 24,
                "concluido": False,
            },
            {
                "titulo": "Revisão de contrato comercial",
                "cliente": clientes["TecVale Industria Ltda"],
                "processo": processos["PROC-2026-0002"],
                "tipo_evento": "Reunião",
                "status": "Concluído",
                "prioridade": "Média",
                "responsavel": usuarios["Renata Soares"].nome,
                "local": "Videochamada",
                "descricao": "Revisão final de minuta comercial.",
                "observacoes": "Compromisso concluído para demonstração.",
                "day_offset": -1,
                "hour": 11,
                "minute": 0,
                "duration_hours": 1,
                "lembrete_horas": 2,
                "concluido": True,
            },
            {
                "titulo": "Prazo para manifestação",
                "cliente": clientes["Mariana Souza"],
                "processo": processos["PROC-2026-0001"],
                "tipo_evento": "Prazo",
                "status": "Atrasado",
                "prioridade": "Alta",
                "responsavel": usuarios["Larissa Prado"].nome,
                "local": "Portal do tribunal",
                "descricao": "Manifestação sobre documentos juntados pela parte contrária.",
                "observacoes": "Compromisso vencido para demonstração da agenda.",
                "day_offset": -2,
                "hour": 18,
                "minute": 0,
                "duration_hours": 1,
                "lembrete_horas": 24,
                "concluido": False,
            },
            {
                "titulo": "Organização de anexos",
                "cliente": clientes["Helena Martins"],
                "processo": processos["PROC-2026-0005"],
                "tipo_evento": "Tarefa interna",
                "status": "Aguardando",
                "prioridade": "Baixa",
                "responsavel": usuarios["Bruno Lima"].nome,
                "local": "Arquivo digital",
                "descricao": "Separar comprovantes e atualizar pasta do caso.",
                "observacoes": "Tarefa demo para a semana seguinte.",
                "day_offset": 7,
                "hour": 9,
                "minute": 30,
                "duration_hours": 1,
                "duration_minutes": 30,
                "lembrete_horas": 12,
                "concluido": False,
            },
        ]

        for item in demo_eventos:
            start, end = self.make_dt(
                today,
                item["day_offset"],
                item["hour"],
                item["minute"],
                item.get("duration_hours", 1),
                item.get("duration_minutes", 0),
            )
            lembrete = start - timedelta(hours=item["lembrete_horas"])

            self.upsert(
                Evento,
                {"titulo": item["titulo"], "criado_por": "seed_demo"},
                {
                    "descricao": item["descricao"],
                    "data_inicio": start,
                    "data_fim": end,
                    "tipo_evento": item["tipo_evento"],
                    "status": item["status"],
                    "prioridade": item["prioridade"],
                    "cliente": item["cliente"],
                    "processo": item["processo"],
                    "responsavel": item["responsavel"],
                    "local": item["local"],
                    "observacoes": item["observacoes"],
                    "lembrete_em": lembrete,
                    "concluido": item["concluido"],
                },
                "compromissos",
            )
