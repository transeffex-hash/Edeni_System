from __future__ import annotations

from functools import lru_cache
from typing import Iterable

from backend.app.core.config import settings


@lru_cache
def _firebase_app_initialized() -> bool:
    """Initialize Firebase Admin SDK once.

    Why we cache this:
    - Firebase Admin initialization is expensive.
    - In API servers, modules can be imported multiple times in different workers.

    Deployment notes:
    - You must provide a Firebase service account JSON.
    - Set `FIREBASE_SERVICE_ACCOUNT_PATH` to its file path.
    - Never commit the JSON key to git.
    """

    if not settings.firebase_service_account_path:
        return False

    import firebase_admin
    from firebase_admin import credentials

    try:
        cred = credentials.Certificate(settings.firebase_service_account_path)
        firebase_admin.initialize_app(cred)
        return True
    except Exception:
        # If init fails, we keep push disabled. The API must still work.
        return False


def send_push(tokens: Iterable[str], title: str, body: str, data: dict[str, str] | None = None) -> None:
    """Send an FCM notification to multiple device tokens.

    This function is best-effort:
    - If Firebase is not configured, it does nothing.
    - If some tokens are invalid, Firebase will report it.

    We keep it synchronous for simplicity.
    If later load increases, we can move it to a background task/queue.
    """

    if not _firebase_app_initialized():
        return

    from firebase_admin import messaging

    token_list = [t for t in tokens if t]
    if not token_list:
        return

    message = messaging.MulticastMessage(
        tokens=token_list,
        notification=messaging.Notification(title=title, body=body),
        data=data or {},
    )

    messaging.send_multicast(message)
