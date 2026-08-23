from functools import lru_cache

from backend.app.core.config import settings


@lru_cache
def _get_supabase_client():
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return None
    try:
        from supabase import create_client, Client
        return create_client(settings.supabase_url, settings.supabase_service_role_key)
    except Exception:
        return None


def upload_logo(business_id: int, file_bytes: bytes, content_type: str, ext: str) -> str | None:
    """
    Upload a business logo to Supabase Storage bucket 'business-logos'.
    Returns the public URL if successful, None if Supabase is not configured.
    """
    client = _get_supabase_client()
    if not client:
        return None

    filename = f"business_{business_id}.{ext}"
    path = f"logos/{filename}"

    try:
        client.storage.from_("business-logos").upload(
            path=path,
            file=file_bytes,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        public_url = client.storage.from_("business-logos").get_public_url(path)
        return public_url
    except Exception:
        return None
