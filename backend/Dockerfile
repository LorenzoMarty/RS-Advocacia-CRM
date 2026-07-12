# Celery worker image for meeting-recording processing.
# Built from deploy/worker/docker-compose.yml (context = backend/).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=jurisagenda.settings

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# The worker only consumes tasks; migrations run in the web service (RUN_MIGRATIONS=1).
CMD ["celery", "-A", "jurisagenda", "worker", "--loglevel=info", "--concurrency=2"]
