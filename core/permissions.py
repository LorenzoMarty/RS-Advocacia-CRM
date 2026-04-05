from collections.abc import Callable
from functools import wraps
from typing import Any

from django.contrib.auth.decorators import login_required, permission_required


def app_permissions_required(*permissions: str):
    required_permissions: str | tuple[str, ...]
    if len(permissions) == 1:
        required_permissions = permissions[0]
    else:
        required_permissions = permissions

    def decorator(view_func: Callable[..., Any]):
        protected_view = permission_required(
            required_permissions,
            raise_exception=True,
        )(view_func)

        @wraps(view_func)
        def wrapped_view(*args: Any, **kwargs: Any):
            return protected_view(*args, **kwargs)

        return login_required(wrapped_view)

    return decorator
