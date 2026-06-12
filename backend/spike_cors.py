# ruff: noqa: E402
# One-off spike: validate CORS behavior of Drive resumable upload sessions.
# Run: .venv/Scripts/python.exe spike_cors.py
# Creates a tiny test file in the connected user's My Drive, then deletes it.
import json
import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "jurisagenda.settings")
django.setup()

import requests
from google.auth.transport.requests import AuthorizedSession

from integrations.google.client import credentials_for_usuario, drive_service
from integrations.models import GoogleAccount

ORIGIN = "http://localhost:5173"
DATA = b"spike-cors-test-payload"

credentials = None
usuario = None
for account in GoogleAccount.objects.filter(revoked_at__isnull=True).select_related(
    "usuario"
):
    if not account.connected:
        print(
            f"SPIKE: conta usuario={account.usuario_id} sem refresh token utilizavel, pulando"
        )
        continue
    try:
        credentials = credentials_for_usuario(account.usuario)
        usuario = account.usuario
        break
    except Exception as exc:  # noqa: BLE001 - spike only
        print(f"SPIKE: conta usuario={account.usuario_id} falhou: {exc}")
if credentials is None or usuario is None:
    raise SystemExit("SPIKE: nenhum GoogleAccount conectado utilizavel")
print(f"SPIKE: usando usuario id={usuario.pk}")
authed = AuthorizedSession(credentials)

init = authed.post(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
    headers={
        "Origin": ORIGIN,
        "X-Upload-Content-Type": "audio/webm",
        "X-Upload-Content-Length": str(len(DATA)),
        "Content-Type": "application/json; charset=UTF-8",
    },
    data=json.dumps({"name": "spike-cors-test.webm"}),
    timeout=30,
)
print(f"SPIKE init: status={init.status_code}")
session_url = init.headers.get("Location", "")
print(f"SPIKE init: location presente={bool(session_url)}")
print(f"SPIKE init: ACAO={init.headers.get('Access-Control-Allow-Origin')!r}")
if not session_url:
    raise SystemExit(f"SPIKE: sem session URL; body={init.text[:300]}")

# Browser preflight simulation (no auth — browser won't send it)
preflight = requests.options(
    session_url,
    headers={
        "Origin": ORIGIN,
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "content-type",
    },
    timeout=30,
)
print(f"SPIKE preflight: status={preflight.status_code}")
print(f"SPIKE preflight: ACAO={preflight.headers.get('Access-Control-Allow-Origin')!r}")
print(
    f"SPIKE preflight: ACAM={preflight.headers.get('Access-Control-Allow-Methods')!r}"
)

# Actual PUT without Authorization, with Origin (as the browser would send)
put = requests.put(
    session_url,
    headers={"Origin": ORIGIN, "Content-Type": "audio/webm"},
    data=DATA,
    timeout=60,
)
print(f"SPIKE put: status={put.status_code}")
print(f"SPIKE put: ACAO={put.headers.get('Access-Control-Allow-Origin')!r}")
file_id = ""
try:
    file_id = put.json().get("id", "")
except Exception:
    pass
print(f"SPIKE put: file_id presente={bool(file_id)}")

# Wrong-origin PUT should be unauthorized at the CORS level (header mismatch);
# server may still accept the bytes — what matters is the browser would block reads.
wrong = requests.options(
    session_url,
    headers={
        "Origin": "https://malicioso.example",
        "Access-Control-Request-Method": "PUT",
    },
    timeout=30,
)
print(
    f"SPIKE wrong-origin preflight: status={wrong.status_code} ACAO={wrong.headers.get('Access-Control-Allow-Origin')!r}"
)

if file_id:
    service = drive_service(usuario)
    service.files().delete(fileId=file_id, supportsAllDrives=True).execute()
    print("SPIKE: arquivo de teste apagado")
print("SPIKE: fim")
