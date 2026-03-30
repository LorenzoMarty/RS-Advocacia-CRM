from django.shortcuts import render

from usuarios.models import Usuario

# Create your views here.
def listar_usuarios(request):
    usuarios = Usuario.objects.all()
    return render(request, 'listar_usuarios.html', {'usuarios': usuarios})

def criar_usuario(request):
    if request.method == 'POST':
        nome = request.POST.get('nome')
        email = request.POST.get('email')
        senha = request.POST.get('senha')
        cargo = request.POST.get('cargo')
        foto = request.FILES.get('foto')
        OAB = request.POST.get('OAB')
        Usuario.objects.create(nome=nome, email=email, senha=senha, cargo=cargo, foto=foto, OAB=OAB)
    return render(request, 'criar_usuario.html')

def detalhes_usuario(request, usuario_id):
    usuario = Usuario.objects.get(id=usuario_id)
    return render(request, 'detalhes_usuario.html', {'usuario': usuario})

def editar_usuario(request, usuario_id):
    usuario = Usuario.objects.get(id=usuario_id)
    if request.method == 'POST':
        usuario.nome = request.POST.get('nome')
        usuario.email = request.POST.get('email')
        usuario.senha = request.POST.get('senha')
        usuario.cargo = request.POST.get('cargo')
        if 'foto' in request.FILES:
            usuario.foto = request.FILES['foto']
        usuario.OAB = request.POST.get('OAB')
        usuario.save()
    return render(request, 'editar_usuario.html', {'usuario': usuario})

def excluir_usuario(request, usuario_id):
    usuario = Usuario.objects.get(id=usuario_id)
    if request.method == 'POST':
        usuario.delete()
        return render(request, 'excluir_usuario.html', {'success': True})
    return render(request, 'excluir_usuario.html', {'usuario': usuario})