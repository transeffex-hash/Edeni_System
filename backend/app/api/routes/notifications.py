from datetime import date, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user
from backend.app.core.config import settings
from backend.app.core.db import get_db
from backend.app.core.push import enqueue_push
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
        existing.user_id = user.id
        existing.business_id = user.business_id
        existing.is_admin = False
    else:
        row = DeviceToken(user_id=user.id, business_id=user.business_id, token=payload.token)
        db.add(row)
    db.commit()
    return {"ok": True}


@router.post("/daily-cron")
def daily_cron(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    x_cron_secret: str | None = Header(default=None),
):
    if settings.env != "dev":
        if not settings.cron_secret:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Cron secret is not configured")
        if x_cron_secret != settings.cron_secret:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid cron secret")

    today = date.today()
    businesses = db.query(Business).filter(Business.is_active == True, Business.is_deleted == False).all()

    for biz in businesses:
        boss_ids = [row[0] for row in db.query(User.id).filter(User.business_id == biz.id, User.role == UserRole.boss).all()]
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
                enqueue_push(background_tasks, tokens, title="Expiry Alert", body=f"{len(expiring)} product batch(es) expiring {day_str}.")

        # 2. Subscription Check
        if biz.subscription_end_date:
            days_left = (biz.subscription_end_date - today).days
            if days_left in [14, 7, 3, 1, 0]:
                day_str = "today" if days_left == 0 else f"in {days_left} days"
                enqueue_push(background_tasks, tokens, title="Subscription Alert", body=f"Your subscription expires {day_str}.")

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
            enqueue_push(background_tasks, tokens, title="Credit Alert", body=f"{len(balances)} customer(s) have outstanding balances > 10,000.")

    return {"ok": True}


@router.post("/test-push")
def test_push(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tokens = [t.token for t in db.query(DeviceToken).filter(DeviceToken.user_id == user.id).all()]
    if not tokens:
        return {"ok": False, "reason": "no_tokens_for_user"}
    enqueue_push(background_tasks, tokens, title="Test Notification", body=f"Hello {user.id}! Push notifications are working.")
    return {"ok": True, "tokens_sent": len(tokens)}
