from supabase import Client, create_client

from app.config import (
    SUPABASE_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
    validate_config,
)


def get_supabase_client(access_token: str | None = None) -> Client:
    """Create a Supabase client using the supplied citizen session."""
    validate_config()

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    if access_token:
        client.postgrest.auth(access_token)
        client.auth.set_session(access_token, "")

    return client


_admin_client_singleton: Client | None = None


def get_supabase_admin_client() -> Client:
    """Get or create the trusted server-side client for privileged operations with connection pooling."""
    global _admin_client_singleton
    if _admin_client_singleton is None:
        validate_config()
        if not SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError(
                "SUPABASE_SERVICE_ROLE_KEY is not configured."
            )
        _admin_client_singleton = create_client(
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY,
        )
    return _admin_client_singleton