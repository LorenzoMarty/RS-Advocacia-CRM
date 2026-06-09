from django.db import models


class TimeEntry(models.Model):
    TASK_PETICAO = "peticao"
    TASK_CONTESTACAO = "contestacao"
    TASK_PRAZO = "prazo"

    TASK_CHOICES = (
        (TASK_PETICAO, "Petição"),
        (TASK_CONTESTACAO, "Contestação"),
        (TASK_PRAZO, "Prazo"),
    )

    STATUS_RUNNING = "running"
    STATUS_PAUSED = "paused"
    STATUS_STOPPED = "stopped"

    STATUS_CHOICES = (
        (STATUS_RUNNING, "Rodando"),
        (STATUS_PAUSED, "Pausado"),
        (STATUS_STOPPED, "Encerrado"),
    )

    user = models.ForeignKey(
        "usuarios.Usuario",
        on_delete=models.CASCADE,
        related_name="time_entries",
    )
    task_id = models.CharField(max_length=64, db_index=True)
    task_type = models.CharField(max_length=20, choices=TASK_CHOICES, db_index=True)
    started_at = models.DateTimeField()
    paused_at = models.DateTimeField(blank=True, null=True)
    resumed_at = models.DateTimeField(blank=True, null=True)
    ended_at = models.DateTimeField(blank=True, null=True)
    total_seconds = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_RUNNING, db_index=True
    )

    class Meta:
        ordering = ("-started_at", "-id")
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["task_type", "task_id"]),
        ]

    def __str__(self):
        return f"{self.user} - {self.task_type} #{self.task_id}"


class ProductivityGoal(models.Model):
    user = models.OneToOneField(
        "usuarios.Usuario",
        on_delete=models.CASCADE,
        related_name="productivity_goal",
    )
    daily_hours = models.DecimalField(max_digits=5, decimal_places=2, default=6)
    weekly_hours = models.DecimalField(max_digits=5, decimal_places=2, default=30)

    class Meta:
        ordering = ("user__nome",)

    def __str__(self):
        return f"Meta de {self.user}"
