from django.contrib import admin

from productivity.models import ProductivityGoal, TimeEntry


@admin.register(TimeEntry)
class TimeEntryAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "task_type",
        "task_id",
        "status",
        "started_at",
        "total_seconds",
    )
    list_filter = ("task_type", "status", "started_at")
    search_fields = ("user__nome", "task_id")


@admin.register(ProductivityGoal)
class ProductivityGoalAdmin(admin.ModelAdmin):
    list_display = ("user", "daily_hours", "weekly_hours")
    search_fields = ("user__nome", "user__email")
