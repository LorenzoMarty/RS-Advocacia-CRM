from django.shortcuts import render
from processos.models import Processo
from processos.forms import ProcessoForm

# Create your views here.
def listar_processos(request):
    processos = Processo.objects.all()
    return render(request, "listar_processos.html", {"processos": processos})

def criar_processo(request):
    if request.method == "POST":
        form = ProcessoForm(request.POST)
        if form.is_valid():
            form.save()
            return render(request, "criar_processo.html", {"form": ProcessoForm(), "success": True})
    else:
        form = ProcessoForm()
    
    return render(request, "criar_processo.html", {"form": form})

def detalhes_processo(request, processo_id):
    processo = Processo.objects.get(id=processo_id)
    return render(request, "detalhes_processo.html", {"processo": processo})

def editar_processo(request, processo_id):
    processo = Processo.objects.get(id=processo_id)
    if request.method == "POST":
        form = ProcessoForm(request.POST, instance=processo)
        if form.is_valid():
            form.save()
            return render(request, "editar_processo.html", {"form": form, "success": True})
    else:
        form = ProcessoForm(instance=processo)
    
    return render(request, "editar_processo.html", {"form": form})

def excluir_processo(request, processo_id):
    processo = Processo.objects.get(id=processo_id)
    if request.method == "POST":
        processo.delete()
        return render(request, "excluir_processo.html", {"success": True})
    
    return render(request, "excluir_processo.html", {"processo": processo})