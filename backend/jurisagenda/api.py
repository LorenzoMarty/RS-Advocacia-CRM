from ninja import NinjaAPI
from ninja.security import django_auth

from clientes.router import router as clientes_router

api = NinjaAPI(
    title="JurisAgenda API",
    version="2.0",
    description="API tipada com documentação automática. Acesse /api/v2/docs para explorar.",
    auth=django_auth,
)

api.add_router("/clientes", clientes_router)
