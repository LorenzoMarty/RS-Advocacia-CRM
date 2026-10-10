from typing import Iterable, cast

from integrations.google.calendar import calendar_label
from integrations.models import GoogleAccount
from usuarios.forms import normalize_cargo_name
from usuarios.models import Cargo, Usuario


def _cargo_map_for_usuarios(usuarios: list[Usuario]) -> dict[str, Cargo]:
    cargo_names = {
        cargo_name
        for usuario in usuarios
        if (cargo_name := normalize_cargo_name(usuario.cargo))
    }
    return cast(
        "dict[str, Cargo]",
        {cargo.name: cargo for cargo in Cargo.objects.filter(name__in=cargo_names)},
    )


def serialize_usuario(
    usuario: Usuario,
    cargos_by_name: dict[str, Cargo] | None = None,
):
    cargo_nome = normalize_cargo_name(usuario.cargo)
    cargo = (
        cargos_by_name.get(cargo_nome)
        if cargos_by_name is not None
        else Cargo.objects.filter(name=cargo_nome).first()
    )
    account = GoogleAccount.objects.filter(usuario=usuario).first()
    return {
        "id": str(usuario.pk),
        "pk": usuario.pk,
        "nome": usuario.nome,
        "email": usuario.email,
        "foto": usuario.picture,
        "cargo": cargo_nome,
        "cargo_id": str(cargo.pk) if cargo else cargo_nome,
        "admin": cargo_nome == "Administrador",
        "google_calendar_conectado": bool(account and account.connected),
        "google_calendar_destino": calendar_label(usuario),
    }


def serialize_usuarios(usuarios: Iterable[Usuario]):
    usuarios = list(usuarios)
    cargos_by_name = _cargo_map_for_usuarios(usuarios)
    return [
        serialize_usuario(usuario, cargos_by_name=cargos_by_name)
        for usuario in usuarios
    ]
