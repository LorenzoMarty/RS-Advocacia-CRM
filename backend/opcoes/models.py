from django.db import models

# Campos que aceitam opções personalizadas via ComboField no frontend. Mantido
# como allow-list para evitar chaves de campo inválidas criadas por engano.
CAMPOS_VALIDOS = (
    "cliente_parceiro",
    "processo_status",
    "processo_area",
    "processo_vara",
    "prospect_origem",
    "financeiro_categoria_receita",
    "financeiro_categoria_despesa",
    "evento_tipo",
)


class OpcaoPersonalizada(models.Model):
    campo = models.CharField(max_length=60)
    valor = models.CharField(max_length=200)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("valor",)
        unique_together = ("campo", "valor")

    def __str__(self):
        return f"{self.campo}: {self.valor}"
