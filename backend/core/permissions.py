from collections.abc import Callable
from functools import wraps
from typing import Any

from core.permission_utils import user_has_all_permissions, user_has_any_permissions
from core.utils import error_response


def app_permissions_required(*permissions: str):
    def decorator(view_func: Callable[..., Any]):
        @wraps(view_func)
        def wrapped_view(request, *args: Any, **kwargs: Any):
            user = getattr(request, "user", None)
            if user is None or not getattr(user, "is_authenticated", False):
                return error_response({"auth": ["Autenticacao necessaria."]}, status=401)

            if permissions and not user_has_all_permissions(request, permissions):
                return error_response({"permission": ["Permissao insuficiente."]}, status=403)

            return view_func(request, *args, **kwargs)

        return wrapped_view

    return decorator


def app_any_permissions_required(*permissions: str):
    def decorator(view_func: Callable[..., Any]):
        @wraps(view_func)
        def wrapped_view(request, *args: Any, **kwargs: Any):
            user = getattr(request, "user", None)
            if user is None or not getattr(user, "is_authenticated", False):
                return error_response({"auth": ["Autenticacao necessaria."]}, status=401)

            if permissions and not user_has_any_permissions(request, permissions):
                return error_response({"permission": ["Permissao insuficiente."]}, status=403)

            return view_func(request, *args, **kwargs)

        return wrapped_view

    return decorator
