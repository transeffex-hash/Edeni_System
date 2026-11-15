from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jose import JWTError, jwt
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.app.core.limiter import limiter

from backend.app.core.config import settings
from backend.app.core.db import get_db
from backend.app.core.security import create_access_token, verify_password
from backend.app.core.pii_crypto import pii_decrypt
from datetime import date, datetime, timedelta

from backend.app.models.entities import Branch, Business, DeviceToken, Product, SubscriptionPayment, User
from backend.app.schemas.admin import BusinessOut, SubscriptionPaymentOut, SubscriptionSet
from backend.app.schemas.notifications import RegisterDeviceToken

router = APIRouter()


def require_platform_admin(request: Request) -> None:
    """Guard for platform admin endpoints.

    Implementation notes (simple but effective for MVP):
    - Admin logs in and receives an httpOnly `admin_token` cookie.
    - This token is a JWT signed by our server.
    - We verify the JWT and require `sub == "platform_admin"`.

    Later improvements:
    - Admin users table
    - MFA
    - Rate limiting
    """

    token = request.cookies.get("admin_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("sub") != "platform_admin":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated") from e


@router.post("/login")
@limiter.limit("10/minute")
def admin_login(request: Request, response: Response, email: str, password: str):
    if not settings.platform_admin_email or not settings.platform_admin_password:
        raise HTTPException(status_code=500, detail="Admin not configured")

    stored = settings.platform_admin_password
    ok_password = verify_password(password, stored) if stored.startswith("$") else (password == stored)

    if email != settings.platform_admin_email or not ok_password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(subject="platform_admin")
    response.set_cookie(
        key="admin_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.env != "dev",
        path="/",
        max_age=60 * 60 * 12,
    )
    return {"ok": True}


@router.post("/logout")
def admin_logout(response: Response):
    response.delete_cookie(key="admin_token", path="/")
    return {"ok": True}

@router.get("/businesses", response_model=list[BusinessOut])
def list_businesses(
    db: Session = Depends(get_db),
    _: None = Depends(require_platform_admin),
):
    rows = (
        db.query(Business)
        .filter(Business.is_deleted == False)  # noqa: E712
        .order_by(Business.id.desc())
        .limit(200)
        .all()
    )
    business_ids = [b.id for b in rows]

    user_counts = dict(
        db.query(User.business_id, func.count(User.id))
        .filter(User.business_id.in_(business_ids))
        .group_by(User.business_id)
        .all()
    ) if business_ids else {}

    product_counts = dict(
        db.query(Product.business_id, func.count(Product.id))
        .filter(Product.business_id.in_(business_ids))
        .group_by(Product.business_id)
        .all()
    ) if business_ids else {}

    branch_counts = dict(
        db.query(Branch.business_id, func.count(Branch.id))
        .filter(Branch.business_id.in_(business_ids))
        .group_by(Branch.business_id)
        .all()
    ) if business_ids else {}

    last_logins = dict(
        db.query(User.business_id, func.max(User.last_login_at))
        .filter(User.business_id.in_(business_ids), User.last_login_at.isnot(None))
        .group_by(User.business_id)
        .all()
    ) if business_ids else {}

    return [
        BusinessOut(
            id=b.id,
            name=b.name,
            phone=pii_decrypt(b.phone_enc) if b.phone_enc else None,
            logo_url=b.logo_url,
            is_active=b.is_active,
            paid_amount_total=float(b.paid_amount_total),
            subscription_start_date=b.subscription_start_date,
            subscription_end_date=b.subscription_end_date,
            created_at=b.created_at,
            user_count=user_counts.get(b.id, 0),
            product_count=product_counts.get(b.id, 0),
            branch_count=branch_counts.get(b.id, 0),
            last_login_at=last_logins.get(b.id),
        )
        for b in rows
    ]


@router.post("/businesses/{business_id}/set-active")
def set_business_active(
    business_id: int,
    is_active: bool,
    db: Session = Depends(get_db),
    _: None = Depends(require_platform_admin),
):
    b = db.query(Business).filter(Business.id == business_id, Business.is_deleted == False).first()
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")

    b.is_active = is_active
    db.commit()
    return {"ok": True}


@router.post("/businesses/{business_id}/add-payment")
def add_payment(
    business_id: int,
    amount: float,
    db: Session = Depends(get_db),
    _: None = Depends(require_platform_admin),
):
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero")

    b = db.query(Business).filter(Business.id == business_id, Business.is_deleted == False).first()
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")

    b.paid_amount_total = float(b.paid_amount_total) + float(amount)
    db.commit()
    return {"ok": True, "paid_amount_total": float(b.paid_amount_total)}


@router.post("/businesses/{business_id}/set-subscription")
def set_subscription(
    business_id: int,
    months: int = 1,
    db: Session = Depends(get_db),
    _: None = Depends(require_platform_admin),
):
    if months <= 0:
        raise HTTPException(status_code=400, detail="Months must be greater than zero")

    b = db.query(Business).filter(Business.id == business_id, Business.is_deleted == False).first()
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")

    today = date.today()
    start_from = b.subscription_end_date if b.subscription_end_date and b.subscription_end_date > today else today
    b.subscription_end_date = start_from + timedelta(days=30 * months)
    b.is_active = True
    db.commit()
    return {"ok": True, "subscription_end_date": b.subscription_end_date.isoformat()}


@router.post("/businesses/{business_id}/subscription")
def set_subscription_dates(
    business_id: int,
    payload: SubscriptionSet,
    db: Session = Depends(get_db),
    _: None = Depends(require_platform_admin),
):
    """Set a subscription period explicitly (start/end dates) and record the payment."""
    if payload.end_date <= payload.start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")
    if payload.amount < 0:
        raise HTTPException(status_code=400, detail="Amount cannot be negative")

    b = db.query(Business).filter(Business.id == business_id, Business.is_deleted == False).first()
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")

    b.subscription_start_date = payload.start_date
    b.subscription_end_date = payload.end_date
    b.is_active = True
    if payload.amount > 0:
        b.paid_amount_total = float(b.paid_amount_total) + float(payload.amount)

    db.add(
        SubscriptionPayment(
            business_id=b.id,
            start_date=payload.start_date,
            end_date=payload.end_date,
            amount=float(payload.amount),
            note=(payload.note or "").strip() or None,
        )
    )
    db.commit()
    return {
        "ok": True,
        "subscription_start_date": b.subscription_start_date.isoformat(),
        "subscription_end_date": b.subscription_end_date.isoformat(),
        "paid_amount_total": float(b.paid_amount_total),
    }


@router.get("/businesses/{business_id}/subscription-payments", response_model=list[SubscriptionPaymentOut])
def list_subscription_payments(
    business_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_platform_admin),
):
    rows = (
        db.query(SubscriptionPayment)
        .filter(SubscriptionPayment.business_id == business_id)
        .order_by(SubscriptionPayment.id.desc())
        .all()
    )
    return [
        SubscriptionPaymentOut(
            id=r.id,
            start_date=r.start_date,
            end_date=r.end_date,
            amount=float(r.amount or 0),
            note=r.note,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/businesses/{business_id}/delete")
def delete_business(
    business_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_platform_admin),
):
    # Soft delete:
    # - We do not physically delete rows (safer for audits and data recovery).
    # - App enforcement: inactive/deleted businesses should be blocked from using the app.
    b = db.query(Business).filter(Business.id == business_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")

    b.is_deleted = True
    b.is_active = False
    db.commit()
    return {"ok": True}


@router.post("/register-device")
@limiter.limit("10/minute")
def register_admin_device(
    request: Request,
    payload: RegisterDeviceToken,
    db: Session = Depends(get_db),
):
    require_platform_admin(request)
    existing = db.query(DeviceToken).filter(DeviceToken.token == payload.token).first()
    if existing:
        existing.user_id = None
        existing.business_id = None
        existing.is_admin = True
    else:
        db.add(DeviceToken(token=payload.token, is_admin=True))
    db.commit()
    return {"ok": True}
