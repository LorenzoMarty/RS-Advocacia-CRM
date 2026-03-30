from django.urls import include, path

from core.views import dashboard

urlpatterns = [
    path('', dashboard, name='dashboard'),
]