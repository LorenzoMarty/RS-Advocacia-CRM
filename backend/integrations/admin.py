from django.contrib import admin

from integrations.models import GoogleAccount, GoogleCalendar, GoogleEventLink


@admin.register(GoogleAccount)
class GoogleAccountAdmin(admin.ModelAdmin):
    list_display = ("email", "usuario", "google_user_id", "token_expiry", "revoked_at")
    search_fields = ("email", "google_user_id", "usuario__email")
    readonly_fields = (
        "access_token_ciphertext",
        "refresh_token_ciphertext",
        "created_at",
        "updated_at",
    )


@admin.register(GoogleCalendar)
class GoogleCalendarAdmin(admin.ModelAdmin):
    list_display = (
        "summary",
        "calendar_id",
        "account",
        "enabled",
        "last_synced_at",
        "watch_expiration",
    )
    list_filter = ("enabled", "primary")


@admin.register(GoogleEventLink)
class GoogleEventLinkAdmin(admin.ModelAdmin):
    list_display = (
        "google_event_id",
        "calendar",
        "evento",
        "source_of_truth",
        "sync_version",
        "remote_updated_at",
        "last_synced_at",
    )
