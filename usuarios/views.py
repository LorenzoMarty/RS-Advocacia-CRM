from django.contrib import messages
from django.shortcuts import redirect, render
from django.urls import reverse

from usuarios.forms import UsuarioForm
from usuarios.models import Usuario


def listar_usuarios(request):
    usuarios = Usuario.objects.all()
    return render(request, "listar_usuarios.html", {"usuarios": usuarios})


def criar_usuario(request):
    if request.method == "POST":
        form = UsuarioForm(request.POST, request.FILES)
        if form.is_valid():
            form.save()
            messages.success(request, "Usuario criado com sucesso!")
            return render(request, "criar_usuario.html", {"form": UsuarioForm(), "success": True})
    else:
        form = UsuarioForm()

    return render(request, "criar_usuario.html", {"form": form})


def detalhes_usuario(request, usuario_id):
    usuario = Usuario.objects.get(id=usuario_id)
    return render(request, "detalhes_usuario.html", {"usuario": usuario})


def editar_usuario(request, usuario_id):
    usuario = Usuario.objects.get(id=usuario_id)

    if request.method == "POST":
        form = UsuarioForm(request.POST, request.FILES, instance=usuario)
        if form.is_valid():
            form.save()
            messages.success(request, "Usuario atualizado com sucesso!")
            return redirect("detalhes_usuario", usuario_id=usuario.id)
    else:
        form = UsuarioForm(instance=usuario)

    context = {"form": form, "editar": True}
    return render(request, "criar_usuario.html", context)


def excluir_usuario(request, usuario_id):
    usuario = Usuario.objects.get(id=usuario_id)

    if request.method == "POST":
        usuario.delete()
        messages.success(request, "Usuario excluido com sucesso!")
        return redirect("listar_usuarios")

    context = {
        "registro_tipo": "usuario",
        "registro_nome": usuario.nome,
        "registro_meta": usuario.email,
        "voltar_url": reverse("detalhes_usuario", args=[usuario.id]),
    }
    return render(request, "confirmar_exclusao.html", context)
