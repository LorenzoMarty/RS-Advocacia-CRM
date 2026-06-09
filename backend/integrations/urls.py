from django.urls import path

from integrations.google import views

urlpatterns = [
    path("api/autenticacao/google", views.login_google, name="login_google"),
    path("api/autenticacao/google/", views.login_google),
    path("api/auth/google/callback", views.google_callback, name="google_callback"),
    path("api/auth/google/callback/", views.google_callback),
    path(
        "api/integracoes/google/calendar/webhook",
        views.google_calendar_webhook,
        name="google_calendar_webhook",
    ),
    path("api/integracoes/google/calendar/webhook/", views.google_calendar_webhook),
    path(
        "api/integracoes/google/calendarios/", views.calendars, name="google_calendars"
    ),
    path(
        "api/integracoes/google/calendarios/selecionar/",
        views.calendar_selection,
        name="google_calendar_selection",
    ),
    path(
        "api/integracoes/google/desconectar/",
        views.disconnect,
        name="google_disconnect",
    ),
]
