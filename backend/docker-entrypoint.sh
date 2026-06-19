#!/bin/sh
set -e

python - <<'PY'
import os
import time

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "jurisagenda.settings")

import django
from django.db import connections
from django.db.utils import OperationalError

django.setup()

for attempt in range(1, 31):
    try:
        connections["default"].ensure_connection()
        break
    except OperationalError:
        if attempt == 30:
            raise
        time.sleep(2)
PY

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
    python manage.py migrate --noinput
fi

if [ "${COLLECTSTATIC:-0}" = "1" ]; then
    python manage.py collectstatic --noinput
fi

exec "$@"
