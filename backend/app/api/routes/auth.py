from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from backend.app.core.limiter import limiter

from backend.app.core.db import get_db
from backend.app.core.config import settings
from backend.app.core.pii_crypto import pii_encrypt, pii_hash
from backend.app.core.push import enqueue_push
from backend.app.core.security import verify_password, create_access_token, create_refresh_token, hash_password
from backend.app.models.entities import Business, DeviceToken, User, UserRole
from backend.app.schemas.auth import RegisterRequest, Token

router = APIRouter()


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str | None) -> None:
    is_prod = settings.env != "dev"
    # Share cookies across edenisystem.com and www.edenisystem.com / api.edenisystem.com
    cookie_domain = settings.cookie_domain or None
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=is_prod,
        domain=cookie_domain,
        path="/",
        max_age=settings.access_token_expire_minutes * 60,
    )
    if refresh_token:
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            samesite="lax",
            secure=is_prod,
            domain=cookie_domain,
            path="/",
            max_age=settings.refresh_token_expire_minutes * 60,
        )


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    email_hash = pii_hash(form_data.username)
    user = db.query(User).filter(User.email_hash == email_hash, User.is_active == True).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")
    business = db.query(Business).filter(Business.id == user.business_id).first()
    if not business or not business.is_active or business.is_deleted:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Business account is inactive")

    user.last_login_at = datetime.utcnow()
    db.commit()

    token = create_access_token(subject=str(user.id))
    refresh = create_refresh_token(subject=str(user.id))

    _set_auth_cookies(response, token, refresh)
    return Token(access_token=token)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    return {"ok": True}


@router.post("/register", response_model=Token)
@limiter.limit("5/minute")
def register(
    request: Request,
    payload: RegisterRequest,
    response: Response,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if not payload.business_name.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Business name is required")
    if not payload.phone or not payload.phone.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Phone number is required")

    email_hash = pii_hash(payload.owner_email)
    existing = db.query(User).filter(User.email_hash == email_hash, User.is_active == True).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

    phone_clean = payload.phone.strip()
    business = Business(
        name=payload.business_name.strip(),
        phone_enc=pii_encrypt(phone_clean),
        phone_hash=pii_hash(phone_clean),
    )
    db.add(business)
    db.flush()

    boss = User(
        business_id=business.id,
        email_enc=pii_encrypt(payload.owner_email) or "",
        email_hash=email_hash,
        password_hash=hash_password(payload.password),
        role=UserRole.boss,
        last_login_at=datetime.utcnow(),
    )
    db.add(boss)
    db.commit()
    db.refresh(boss)

    admin_tokens = [t.token for t in db.query(DeviceToken).filter(DeviceToken.is_admin == True).all()]
    if admin_tokens:
        enqueue_push(background_tasks, admin_tokens, "New Business Registered", f"{business.name} just signed up.")

    token = create_access_token(subject=str(boss.id))
    refresh = create_refresh_token(subject=str(boss.id))
    _set_auth_cookies(response, token, refresh)
    return Token(access_token=token)


@router.post("/refresh", response_model=Token)
def refresh_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    refresh = request.cookies.get("refresh_token")
    if not refresh:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    try:
        payload = jwt.decode(refresh, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        sub: str | None = payload.get("sub")
        tok_type: str | None = payload.get("type")
        if not sub or tok_type != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
        try:
            user_id = int(sub)
        except (TypeError, ValueError) as e:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from e
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    business = db.query(Business).filter(Business.id == user.business_id).first()
    if not business or not business.is_active or business.is_deleted:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Business account is inactive")

    new_token = create_access_token(subject=str(user.id))
    _set_auth_cookies(response, new_token, None)
    return Token(access_token=new_token)
