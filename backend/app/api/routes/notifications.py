from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user
from backend.app.core.db import get_db
from backend.app.core.push import send_push
from backend.app.models.entities import Business, DeviceToken, LedgerEntry, LedgerType, StockBatch, User, UserRole
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


@router.post("/daily-cron")
def daily_cron(
    db: Session = Depends(get_db),
):
    # Simple cron-friendly design:
    # - Call this endpoint daily (later we can secure it with a cron secret).
    # - It checks expiry, subscriptions, and large balances for all businesses.

    today = date.today()
    businesses = db.query(Business).filter(Business.is_active == True, Business.is_deleted == False).all()

    for biz in businesses:
        boss_ids = [u.id for u in db.query(User).filter(User.business_id == biz.id, User.role == UserRole.boss).all()]
        if not boss_ids:
            continue

        tokens = [t.token for t in db.query(DeviceToken).filter(DeviceToken.user_id.in_(boss_ids)).all()]
        if not tokens:
            continue

        # 1. Expiry Check
        for days in [30, 14, 7, 0]:
            target_date = today + timedelta(days=days)
            expiring = (
                db.query(StockBatch)
                .filter(StockBatch.business_id == biz.id)
                .filter(StockBatch.expiry_date == target_date)
                .filter(StockBatch.quantity > 0)
                .all()
            )
            if expiring:
                day_str = "today" if days == 0 else f"in {days} days"
                send_push(tokens, title="Expiry Alert", body=f"{len(expiring)} product batch(es) expiring {day_str}.")

        # 2. Subscription Check
        if biz.subscription_end_date:
            days_left = (biz.subscription_end_date - today).days
            if days_left in [14, 7, 3, 1, 0]:
                day_str = "today" if days_left == 0 else f"in {days_left} days"
                send_push(tokens, title="Subscription Alert", body=f"Your subscription expires {day_str}.")

        # 3. Large Outstanding Balances Check
        balances = (
            db.query(LedgerEntry.party_name_hash, func.sum(LedgerEntry.amount))
            .filter(LedgerEntry.business_id == biz.id)
            .filter(LedgerEntry.ledger_type == LedgerType.customer)
            .group_by(LedgerEntry.party_name_hash)
            .having(func.sum(LedgerEntry.amount) > 10000)
            .all()
        )
        if balances:
            send_push(tokens, title="Credit Alert", body=f"{len(balances)} customer(s) have outstanding balances > 10,000.")

    return {"ok": True}
