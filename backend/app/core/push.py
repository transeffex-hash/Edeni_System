from __future__ import annotations

import logging
from functools import lru_cache
from typing import Iterable

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.core.db import SessionLocal

logger = logging.getLogger(__name__)


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
        logger.warning("Firebase service account path is not configured. Skipping push.")
        return False

    import firebase_admin
    from firebase_admin import credentials

    try:
        import os
        from pathlib import Path

        path_str = settings.firebase_service_account_path
        if not os.path.isabs(path_str):
            # Resolve relative path against the backend directory
            base_dir = Path(__file__).resolve().parents[2]
            key_path = base_dir / path_str
        else:
            key_path = Path(path_str)

        cred = credentials.Certificate(str(key_path))
        firebase_admin.initialize_app(cred)
        return True
    except Exception:
        # If init fails, we keep push disabled. The API must still work.
        logger.exception("Firebase initialization failed")
        return False


def send_push(
    tokens: Iterable[str],
    title: str,
    body: str,
    data: dict[str, str] | None = None,
    db: Session | None = None,
) -> list[str]:
    """Send an FCM notification to multiple device tokens.

    This function is best-effort:
    - If Firebase is not configured, it does nothing.
    - If some tokens are invalid, Firebase will report it and we return/delete them.

    We keep it synchronous for simplicity.
    If later load increases, we can move it to a background task/queue.
    """

    if not _firebase_app_initialized():
        logger.warning("Firebase not initialized. Skipping push.")
        return []

    from firebase_admin import messaging

    token_list = [t for t in tokens if t]
    if not token_list:
        logger.info("No push tokens provided. Skipping push.")
        return []

    logger.info("Sending push notification", extra={"token_count": len(token_list), "title": title})
    message = messaging.MulticastMessage(
        tokens=token_list,
        notification=messaging.Notification(title=title, body=body),
        data=data or {},
    )

    response = messaging.send_each_for_multicast(message)
    logger.info(
        "Push notification result: %s delivered, %s failed",
        response.success_count,
        response.failure_count,
    )
    bad_tokens: list[str] = []
    for i, r in enumerate(response.responses):
        if not r.success:
            bad_tokens.append(token_list[i])
            logger.warning(
                "Push token failed (stale token will be removed): token=%s... error=%s",
                token_list[i][:20],
                r.exception,
            )

    if bad_tokens and db is not None:
        try:
            from backend.app.models.entities import DeviceToken

            db.query(DeviceToken).filter(DeviceToken.token.in_(bad_tokens)).delete(synchronize_session=False)
            db.commit()
            logger.info("Removed %s invalid push token(s)", len(bad_tokens))
        except Exception as e:
            db.rollback()
            logger.exception("Failed to clean invalid push tokens")

    return bad_tokens


def send_push_with_new_session(
    tokens: Iterable[str],
    title: str,
    body: str,
    data: dict[str, str] | None = None,
) -> list[str]:
    db = SessionLocal()
    try:
        return send_push(tokens=tokens, title=title, body=body, data=data, db=db)
    finally:
        db.close()


def enqueue_push(
    background_tasks: BackgroundTasks,
    tokens: Iterable[str],
    title: str,
    body: str,
    data: dict[str, str] | None = None,
) -> None:
    token_list = [t for t in tokens if t]
    if not token_list:
        logger.warning("Push notification was not queued because no tokens were available", extra={"title": title})
        return
    logger.warning("Queued background push notification", extra={"token_count": len(token_list), "title": title})
    background_tasks.add_task(send_push_with_new_session, token_list, title, body, data)
