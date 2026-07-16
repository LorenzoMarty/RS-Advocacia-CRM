class GoogleConfigurationError(Exception):
    pass


class GoogleAuthorizationRequired(Exception):
    pass


class GoogleApiError(Exception):
    pass


# Single source of truth for "catch any Google integration failure" call
# sites (views/tasks that need to handle config/auth/API errors uniformly).
GOOGLE_ERRORS = (GoogleConfigurationError, GoogleAuthorizationRequired, GoogleApiError)
