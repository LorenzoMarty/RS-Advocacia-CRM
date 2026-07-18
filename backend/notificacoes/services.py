from .models import Notificacao


def criar_notificacao(usuario, tipo, titulo, mensagem="", link=""):
    if usuario is None:
        return None
    return Notificacao.objects.create(
        usuario=usuario,
        tipo=tipo,
        titulo=titulo,
        mensagem=mensagem,
        link=link,
    )
