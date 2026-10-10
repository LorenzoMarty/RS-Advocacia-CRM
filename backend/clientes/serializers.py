from clientes.models import Cliente


def serialize_cliente(cliente: Cliente):
    return {
        "id": str(cliente.pk),
        "pk": cliente.pk,
        "nome": cliente.nome,
        "email": cliente.email,
        "telefone": cliente.telefone,
        "cpf": cliente.cpf,
        "tipo_cliente": cliente.tipo_cliente,
        "parceria": cliente.parceria,
        "obs": cliente.obs,
        "ativo": cliente.ativo,
    }
