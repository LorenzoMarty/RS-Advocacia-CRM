from django.contrib import admin
from django.http import JsonResponse
from django.urls import path


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
    path('admin/', admin.site.urls),
]
