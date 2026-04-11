import json
from functools import wraps

from django.contrib.auth.hashers import check_password, make_password
from django.core.exceptions import ValidationError
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt

from agenda.models import Evento
from clientes.models import Cliente
from processos.models import Processo
from usuarios.models import Cargo, Usuario


class ApiInputError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def api_view(view):
    @wraps(view)
    @csrf_exempt
    def wrapper(request, *args, **kwargs):
        try:
            return view(request, *args, **kwargs)
        except ApiInputError as exc:
            return api_error(str(exc), status=exc.status)
        except ValidationError as exc:
            if hasattr(exc, 'message_dict'):
                return api_error(exc.message_dict, status=400)
            return api_error(exc.messages, status=400)
        except json.JSONDecodeError:
            return api_error('JSON invalido.', status=400)

    return wrapper


def api_response(data, status=200):
    return JsonResponse(data, status=status, json_dumps_params={'ensure_ascii': False})


def no_content():
    return HttpResponse(status=204)


def api_error(error, status=400):
    return api_response({'error': error}, status=status)


def method_not_allowed(*allowed_methods):
    response = api_error('Metodo nao permitido.', status=405)
    response['Allow'] = ', '.join(allowed_methods)
    return response


def read_json(request):
    if not request.body:
        return {}
    return json.loads(request.body.decode('utf-8'))


def parse_pk(value, label):
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ApiInputError(f'{label} invalido.')


def get_instance(model, pk, label):
    try:
        return model.objects.get(pk=parse_pk(pk, label))
    except model.DoesNotExist:
        raise ApiInputError(f'{label} nao encontrado.', status=404)


def parse_datetime_value(value, label, required=False):
    if not value:
        if required:
            raise ApiInputError(f'{label} e obrigatorio.')
        return None

    parsed = parse_datetime(value)
    if parsed is None:
        raise ApiInputError(f'{label} invalido.')

    if timezone.is_naive(parsed):
        return timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def serialize_datetime(value):
    return value.isoformat() if value else ''


def serialize_cargo(cargo):
    return {
        'id': str(cargo.pk),
        'name': cargo.nome,
        'permissionIds': cargo.permission_ids or [],
    }


def serialize_usuario(usuario):
    return {
        'id': str(usuario.pk),
        'name': usuario.nome,
        'email': usuario.email,
        'roleId': usuario.cargo or '',
        'password': '',
    }


def serialize_cliente(cliente):
    return {
        'id': str(cliente.pk),
        'name': cliente.nome,
        'email': cliente.email,
        'phone': cliente.telefone,
        'document': cliente.cpf,
        'clientType': cliente.tipo_cliente,
        'notes': cliente.obs,
    }


def serialize_processo(processo):
    return {
        'id': str(processo.pk),
        'number': processo.numero_processo,
        'clientId': str(processo.cliente_id),
        'description': processo.descricao,
        'court': processo.vara,
        'area': processo.area_juridica,
        'status': processo.status,
        'owner': processo.advogado_responsavel,
    }


def serialize_evento(evento):
    return {
        'id': str(evento.pk),
        'title': evento.titulo,
        'description': evento.descricao,
        'start': serialize_datetime(evento.data_inicio),
        'end': serialize_datetime(evento.data_fim),
        'type': evento.tipo_evento,
        'status': evento.status,
        'priority': evento.prioridade,
        'clientId': str(evento.cliente_id),
        'processId': str(evento.processo_id),
        'responsible': evento.responsavel,
        'createdBy': evento.criado_por,
        'location': evento.local,
        'notes': evento.observacoes,
        'reminderAt': serialize_datetime(evento.lembrete_em),
        'completed': evento.concluido,
    }


def save_cargo(payload, cargo=None):
    cargo = cargo or Cargo()
    permission_ids = payload.get('permissionIds', cargo.permission_ids or [])

    if not isinstance(permission_ids, list):
        raise ApiInputError('permissionIds deve ser uma lista.')

    cargo.nome = payload.get('name', cargo.nome or '').strip()
    cargo.permission_ids = permission_ids
    cargo.full_clean()
    cargo.save()
    return cargo


def save_usuario(payload, usuario=None):
    usuario = usuario or Usuario()
    usuario.nome = payload.get('name', usuario.nome or '').strip()
    usuario.email = payload.get('email', usuario.email or '').strip()
    usuario.cargo = str(payload.get('roleId', usuario.cargo or '')).strip()

    password = payload.get('password')
    if password:
        usuario.senha = make_password(password)
    elif not usuario.pk:
        raise ApiInputError('Senha e obrigatoria.')

    usuario.full_clean()
    usuario.save()
    return usuario


def password_matches(usuario, password):
    if check_password(password, usuario.senha):
        return True

    if usuario.senha == password:
        usuario.senha = make_password(password)
        usuario.save(update_fields=['senha'])
        return True

    return False


def save_cliente(payload, cliente=None):
    cliente = cliente or Cliente()
    cliente.nome = payload.get('name', cliente.nome or '').strip()
    cliente.email = payload.get('email', cliente.email or '').strip()
    cliente.telefone = payload.get('phone', cliente.telefone or '').strip()
    cliente.cpf = payload.get('document', cliente.cpf or '').strip()
    cliente.tipo_cliente = payload.get('clientType', cliente.tipo_cliente or 'esporadico')
    cliente.obs = payload.get('notes', cliente.obs or '').strip()
    cliente.full_clean()
    cliente.save()
    return cliente


def save_processo(payload, processo=None):
    processo = processo or Processo()
    processo.numero_processo = payload.get('number', processo.numero_processo or '').strip()
    processo.cliente = get_instance(Cliente, payload.get('clientId', processo.cliente_id), 'Cliente')
    processo.descricao = payload.get('description', processo.descricao or '').strip()
    processo.vara = payload.get('court', processo.vara or '').strip()
    processo.area_juridica = payload.get('area', processo.area_juridica or '').strip()
    processo.status = payload.get('status', processo.status or '').strip()
    processo.advogado_responsavel = payload.get('owner', processo.advogado_responsavel or '').strip()
    processo.full_clean()
    processo.save()
    return processo


def save_evento(payload, evento=None):
    evento = evento or Evento()
    evento.titulo = payload.get('title', evento.titulo or '').strip()
    evento.descricao = payload.get('description', evento.descricao or '').strip()
    evento.data_inicio = parse_datetime_value(
        payload.get('start', serialize_datetime(evento.data_inicio)),
        'Data de inicio',
        required=True,
    )
    evento.data_fim = parse_datetime_value(
        payload.get('end', serialize_datetime(evento.data_fim)),
        'Data de fim',
        required=True,
    )
    evento.tipo_evento = payload.get('type', evento.tipo_evento or '').strip()
    evento.status = payload.get('status', evento.status or '').strip()
    evento.prioridade = payload.get('priority', evento.prioridade or '').strip()
    evento.cliente = get_instance(Cliente, payload.get('clientId', evento.cliente_id), 'Cliente')
    evento.processo = get_instance(Processo, payload.get('processId', evento.processo_id), 'Processo')
    evento.responsavel = payload.get('responsible', evento.responsavel or '').strip()
    evento.criado_por = payload.get('createdBy', evento.criado_por or evento.responsavel or 'Interno').strip()
    evento.local = payload.get('location', evento.local or '').strip()
    evento.observacoes = payload.get('notes', evento.observacoes or '').strip()
    evento.lembrete_em = parse_datetime_value(
        payload.get('reminderAt', serialize_datetime(evento.lembrete_em)),
        'Lembrete',
    )
    evento.concluido = bool(payload.get('completed', evento.concluido))
    evento.full_clean()
    evento.save()
    return evento


@api_view
def bootstrap(request):
    if request.method != 'GET':
        return method_not_allowed('GET')

    return api_response(
        {
            'roles': [serialize_cargo(cargo) for cargo in Cargo.objects.order_by('nome')],
            'users': [serialize_usuario(usuario) for usuario in Usuario.objects.order_by('nome')],
            'clients': [serialize_cliente(cliente) for cliente in Cliente.objects.order_by('nome')],
            'processes': [serialize_processo(processo) for processo in Processo.objects.select_related('cliente').order_by('numero_processo')],
            'events': [serialize_evento(evento) for evento in Evento.objects.select_related('cliente', 'processo').order_by('data_inicio')],
        }
    )


@api_view
def login(request):
    if request.method != 'POST':
        return method_not_allowed('POST')

    payload = read_json(request)
    email = payload.get('email', '').strip()
    password = payload.get('password', '')
    usuario = Usuario.objects.filter(email__iexact=email).first()

    if not usuario or not password_matches(usuario, password):
        raise ApiInputError('Email ou senha invalidos.', status=401)

    return api_response({'user': serialize_usuario(usuario)})


@api_view
def roles_collection(request):
    if request.method == 'GET':
        return api_response({'roles': [serialize_cargo(cargo) for cargo in Cargo.objects.order_by('nome')]})
    if request.method == 'POST':
        cargo = save_cargo(read_json(request))
        return api_response({'role': serialize_cargo(cargo)}, status=201)
    return method_not_allowed('GET', 'POST')


@api_view
def role_detail(request, pk):
    cargo = get_instance(Cargo, pk, 'Cargo')

    if request.method == 'GET':
        return api_response({'role': serialize_cargo(cargo)})
    if request.method in {'PUT', 'PATCH'}:
        cargo = save_cargo(read_json(request), cargo)
        return api_response({'role': serialize_cargo(cargo)})
    if request.method == 'DELETE':
        if Usuario.objects.filter(cargo=str(cargo.pk)).exists():
            raise ApiInputError('Cargo possui usuarios vinculados.', status=409)
        cargo.delete()
        return no_content()
    return method_not_allowed('GET', 'PUT', 'PATCH', 'DELETE')


@api_view
def users_collection(request):
    if request.method == 'GET':
        return api_response({'users': [serialize_usuario(usuario) for usuario in Usuario.objects.order_by('nome')]})
    if request.method == 'POST':
        usuario = save_usuario(read_json(request))
        return api_response({'user': serialize_usuario(usuario)}, status=201)
    return method_not_allowed('GET', 'POST')


@api_view
def user_detail(request, pk):
    usuario = get_instance(Usuario, pk, 'Usuario')

    if request.method == 'GET':
        return api_response({'user': serialize_usuario(usuario)})
    if request.method in {'PUT', 'PATCH'}:
        usuario = save_usuario(read_json(request), usuario)
        return api_response({'user': serialize_usuario(usuario)})
    if request.method == 'DELETE':
        usuario.delete()
        return no_content()
    return method_not_allowed('GET', 'PUT', 'PATCH', 'DELETE')


@api_view
def clients_collection(request):
    if request.method == 'GET':
        return api_response({'clients': [serialize_cliente(cliente) for cliente in Cliente.objects.order_by('nome')]})
    if request.method == 'POST':
        cliente = save_cliente(read_json(request))
        return api_response({'client': serialize_cliente(cliente)}, status=201)
    return method_not_allowed('GET', 'POST')


@api_view
def client_detail(request, pk):
    cliente = get_instance(Cliente, pk, 'Cliente')

    if request.method == 'GET':
        return api_response({'client': serialize_cliente(cliente)})
    if request.method in {'PUT', 'PATCH'}:
        cliente = save_cliente(read_json(request), cliente)
        return api_response({'client': serialize_cliente(cliente)})
    if request.method == 'DELETE':
        cliente.delete()
        return no_content()
    return method_not_allowed('GET', 'PUT', 'PATCH', 'DELETE')


@api_view
def processes_collection(request):
    if request.method == 'GET':
        return api_response({'processes': [serialize_processo(processo) for processo in Processo.objects.select_related('cliente').order_by('numero_processo')]})
    if request.method == 'POST':
        processo = save_processo(read_json(request))
        return api_response({'process': serialize_processo(processo)}, status=201)
    return method_not_allowed('GET', 'POST')


@api_view
def process_detail(request, pk):
    processo = get_instance(Processo, pk, 'Processo')

    if request.method == 'GET':
        return api_response({'process': serialize_processo(processo)})
    if request.method in {'PUT', 'PATCH'}:
        processo = save_processo(read_json(request), processo)
        return api_response({'process': serialize_processo(processo)})
    if request.method == 'DELETE':
        processo.delete()
        return no_content()
    return method_not_allowed('GET', 'PUT', 'PATCH', 'DELETE')


@api_view
def events_collection(request):
    if request.method == 'GET':
        return api_response({'events': [serialize_evento(evento) for evento in Evento.objects.select_related('cliente', 'processo').order_by('data_inicio')]})
    if request.method == 'POST':
        evento = save_evento(read_json(request))
        return api_response({'event': serialize_evento(evento)}, status=201)
    return method_not_allowed('GET', 'POST')


@api_view
def event_detail(request, pk):
    evento = get_instance(Evento, pk, 'Compromisso')

    if request.method == 'GET':
        return api_response({'event': serialize_evento(evento)})
    if request.method in {'PUT', 'PATCH'}:
        evento = save_evento(read_json(request), evento)
        return api_response({'event': serialize_evento(evento)})
    if request.method == 'DELETE':
        evento.delete()
        return no_content()
    return method_not_allowed('GET', 'PUT', 'PATCH', 'DELETE')
