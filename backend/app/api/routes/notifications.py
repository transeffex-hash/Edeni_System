from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user
from backend.app.core.db import get_db
from backend.app.core.push import send_push
from backend.app.models.entities import DeviceToken, StockBatch, User, UserRole
from backend.app.schemas.notifications import RegisterDeviceToken

router = APIRouter()


@router.post("/register-device")
def register_device(
    payload: RegisterDeviceToken,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Stores the device token so we can send push notifications.
    # Tokens are unique; if the same token is re-registered we just keep one row.
    existing = db.query(DeviceToken).filter(DeviceToken.token == payload.token).first()
    if existing:
        return {"ok": True}

    row = DeviceToken(user_id=user.id, business_id=user.business_id, token=payload.token)
    db.add(row)
    db.commit()
    return {"ok": True}


@router.post("/run-expiry-check")
def run_expiry_check(
    days_before: int = 7,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Simple cron-friendly design:
    # - Call this endpoint daily (later we can secure it with a cron secret).
    # - It checks stock batches nearing expiry and notifies boss.

    cutoff = date.today() + timedelta(days=days_before)

    expiring = (
        db.query(StockBatch)
        .filter(StockBatch.business_id == user.business_id)
        .filter(StockBatch.expiry_date.isnot(None))
        .filter(StockBatch.expiry_date <= cutoff)
        .filter(StockBatch.quantity > 0)
        .order_by(StockBatch.expiry_date.asc())
        .limit(50)
        .all()
    )

    if not expiring:
        return {"ok": True, "count": 0}

    boss_ids = [u.id for u in db.query(User).filter(User.business_id == user.business_id).filter(User.role == UserRole.boss).all()]
    tokens = [t.token for t in db.query(DeviceToken).filter(DeviceToken.user_id.in_(boss_ids)).all()] if boss_ids else []

    send_push(tokens, title="Expiry alert", body=f"{len(expiring)} item(s) nearing expiry")

    return {"ok": True, "count": len(expiring)}
