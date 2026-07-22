from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from backend.app.core.limiter import limiter

from backend.app.core.config import settings
from backend.app.core.db import get_db
from backend.app.core.security import create_access_token, verify_password
from backend.app.core.pii_crypto import pii_decrypt
from backend.app.models.entities import Business
from backend.app.schemas.admin import BusinessOut

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
    return [
        BusinessOut(
            id=b.id,
            name=b.name,
            phone=pii_decrypt(b.phone_enc) if b.phone_enc else None,
            is_active=b.is_active,
            paid_amount_total=float(b.paid_amount_total),
            created_at=b.created_at,
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
    b = db.query(Business).filter(Business.id == business_id).first()
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
    b = db.query(Business).filter(Business.id == business_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")

    b.paid_amount_total = float(b.paid_amount_total) + float(amount)
    db.commit()
    return {"ok": True, "paid_amount_total": float(b.paid_amount_total)}


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
