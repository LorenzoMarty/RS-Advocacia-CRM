from django.db import models

from integrations.google.tokens import decrypt_value, encrypt_value


class GoogleAccount(models.Model):
    usuario = models.OneToOneField(
        "usuarios.Usuario",
        on_delete=models.CASCADE,
        related_name="google_account",
    )
    google_user_id = models.CharField(max_length=255, unique=True)
    email = models.EmailField()
    scopes = models.TextField(blank=True, default="")
    access_token_ciphertext = models.TextField(blank=True, default="")
    refresh_token_ciphertext = models.TextField(blank=True, default="")
    token_expiry = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def access_token(self) -> str:
        return decrypt_value(self.access_token_ciphertext)

    @property
    def refresh_token(self) -> str:
        return decrypt_value(self.refresh_token_ciphertext)

    @property
    def connected(self) -> bool:
        return bool(self.refresh_token) and self.revoked_at is None

    def store_tokens(
        self,
        *,
        access_token: str,
        refresh_token: str | None = None,
        expiry=None,
        scopes: str | None = None,
    ) -> None:
        self.access_token_ciphertext = encrypt_value(access_token)
        if refresh_token:
            self.refresh_token_ciphertext = encrypt_value(refresh_token)
        self.token_expiry = expiry
        if scopes is not None:
            self.scopes = scopes
        self.revoked_at = None

    def __str__(self) -> str:
        return self.email


class GoogleCalendar(models.Model):
    account = models.ForeignKey(
        GoogleAccount,
        on_delete=models.CASCADE,
        related_name="calendars",
    )
    calendar_id = models.CharField(max_length=512)
    summary = models.CharField(max_length=255, blank=True, default="")
    timezone = models.CharField(max_length=100, blank=True, default="")
    primary = models.BooleanField(default=False)
    enabled = models.BooleanField(default=True)
    sync_token_ciphertext = models.TextField(blank=True, default="")
    last_synced_at = models.DateTimeField(null=True, blank=True)
    watch_channel_id = models.CharField(max_length=255, blank=True, default="")
    watch_resource_id = models.CharField(max_length=255, blank=True, default="")
    watch_token = models.CharField(max_length=255, blank=True, default="")
    watch_expiration = models.DateTimeField(null=True, blank=True)
    last_notification_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("account", "calendar_id"),
                name="unique_google_calendar_per_account",
            )
        ]

    @property
    def sync_token(self) -> str:
        return decrypt_value(self.sync_token_ciphertext)

    def set_sync_token(self, value: str | None) -> None:
        self.sync_token_ciphertext = encrypt_value(value or "") if value else ""

    def __str__(self) -> str:
        return self.summary or self.calendar_id


class GoogleEventLink(models.Model):
    SOURCE_LOCAL = "local"
    SOURCE_GOOGLE = "google"
    SOURCE_CHOICES = (
        (SOURCE_LOCAL, "Local"),
        (SOURCE_GOOGLE, "Google"),
    )

    calendar = models.ForeignKey(
        GoogleCalendar,
        on_delete=models.CASCADE,
        related_name="event_links",
    )
    evento = models.ForeignKey(
        "agenda.Evento",
        on_delete=models.CASCADE,
        related_name="google_links",
    )
    google_event_id = models.TextField()
    etag = models.CharField(max_length=255, blank=True, default="")
    local_payload_hash = models.CharField(max_length=64, blank=True, default="")
    timezone = models.CharField(max_length=100, blank=True, default="")
    source_of_truth = models.CharField(
        max_length=20,
        choices=SOURCE_CHOICES,
        default=SOURCE_LOCAL,
    )
    sync_version = models.PositiveIntegerField(default=0)
    remote_updated_at = models.DateTimeField(null=True, blank=True)
    remote_sequence = models.IntegerField(null=True, blank=True)
    remote_deleted_at = models.DateTimeField(null=True, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("calendar", "evento"),
                name="unique_google_link_per_event_calendar",
            ),
            models.UniqueConstraint(
                fields=("calendar", "google_event_id"),
                name="unique_google_event_per_calendar",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.calendar.calendar_id}:{self.google_event_id}"


class GoogleDriveSync(models.Model):
    """Cursor into the Drive changes feed for one connected account.

    Mirrors :class:`GoogleCalendar`'s ``sync_token`` pattern but scoped to the
    whole Drive (there is one shared "Clientes" tree, not one folder per
    account), so it's a single cursor per account rather than one per
    calendar. Not encrypted: a Drive page token is an opaque pagination
    cursor, not a credential.
    """

    account = models.OneToOneField(
        GoogleAccount,
        on_delete=models.CASCADE,
        related_name="drive_sync",
    )
    start_page_token = models.CharField(max_length=255, blank=True, default="")
    last_synced_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"Drive sync de {self.account.email}"
