from django.shortcuts import render
from clientes.models import Cliente
from clientes.forms import ClienteForm

# Create your views here.
def listar_clientes(request):
    clientes = Cliente.objects.all()
    return render(request, "listar_clientes.html", {"clientes": clientes})

def criar_cliente(request):
    if request.method == "POST":
        form = ClienteForm(request.POST)
        if form.is_valid():
            form.save()
            return render(request, "criar_cliente.html", {"form": ClienteForm(), "success": True})
    else:
        form = ClienteForm()
    
    return render(request, "criar_cliente.html", {"form": form})

def detalhes_cliente(request, cliente_id):
    cliente = Cliente.objects.get(id=cliente_id)
    return render(request, "detalhes_cliente.html", {"cliente": cliente})

def editar_cliente(request, cliente_id):
    cliente = Cliente.objects.get(id=cliente_id)
    if request.method == "POST":
        form = ClienteForm(request.POST, instance=cliente)
        if form.is_valid():
            form.save()
            return render(request, "editar_cliente.html", {"form": form, "success": True})
    else:
        form = ClienteForm(instance=cliente)
    
    return render(request, "editar_cliente.html", {"form": form})

def excluir_cliente(request, cliente_id):
    cliente = Cliente.objects.get(id=cliente_id)
    if request.method == "POST":
        cliente.delete()
        return render(request, "excluir_cliente.html", {"success": True})
    
    return render(request, "excluir_cliente.html", {"cliente": cliente})