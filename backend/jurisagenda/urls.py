from django.contrib import admin
from django.http import JsonResponse
from django.urls import path

from core import api


def backend_status(_request):
    return JsonResponse(
        {
            'name': 'jurisagenda-backend',
            'status': 'ok',
            'frontend': 'frontend/',
        }
    )

urlpatterns = [
    path('', backend_status, name='backend_status'),
    path('api/bootstrap/', api.bootstrap, name='api_bootstrap'),
    path('api/auth/login/', api.login, name='api_login'),
    path('api/roles/', api.roles_collection, name='api_roles'),
    path('api/roles/<int:pk>/', api.role_detail, name='api_role_detail'),
    path('api/users/', api.users_collection, name='api_users'),
    path('api/users/<int:pk>/', api.user_detail, name='api_user_detail'),
    path('api/clients/', api.clients_collection, name='api_clients'),
    path('api/clients/<int:pk>/', api.client_detail, name='api_client_detail'),
    path('api/processes/', api.processes_collection, name='api_processes'),
    path('api/processes/<int:pk>/', api.process_detail, name='api_process_detail'),
    path('api/events/', api.events_collection, name='api_events'),
    path('api/events/<int:pk>/', api.event_detail, name='api_event_detail'),
    path('admin/', admin.site.urls),
]
