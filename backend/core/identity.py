"""Resolve who is making a request: Django auth ``User`` vs. domain ``Usuario``."""

from django.contrib.auth.models import AnonymousUser, User
from django.http import HttpRequest

from usuarios.models import Usuario


def authenticated_user(request: HttpRequest) -> User | None:
    request_user = getattr(request, "user", None)
    if (
        request_user is None
        or isinstance(request_user, AnonymousUser)
        or not getattr(request_user, "is_authenticated", False)
    ):
        return None
    return request_user


def current_usuario(request: HttpRequest) -> Usuario | None:
    """Session ``usuario_id`` first, then the auth user's email, then username.

    Email matching is case-insensitive (``Usuario.email`` is unique).
    """
    usuario_id = request.session.get("usuario_id")
    if usuario_id:
        usuario = Usuario.objects.filter(pk=usuario_id).first()
        if usuario is not None:
            return usuario

    auth_user = authenticated_user(request)
    if auth_user is None:
        return None

    for identifier in (auth_user.email, auth_user.username):
        if not identifier:
            continue
        usuario = Usuario.objects.filter(email__iexact=identifier).first()
        if usuario is not None:
            return usuario
    return None


def is_admin(request: HttpRequest, usuario: Usuario | None = None) -> bool:
    auth_user = authenticated_user(request)
    if auth_user and (auth_user.is_staff or auth_user.is_superuser):
        return True
    if auth_user and auth_user.groups.filter(name="Administrador").exists():
        return True
    return usuario is not None and usuario.cargo == "Administrador"
