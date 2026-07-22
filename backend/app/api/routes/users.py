from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user, require_boss
from backend.app.core.db import get_db
from backend.app.core.pii_crypto import pii_decrypt, pii_encrypt, pii_hash
from backend.app.core.security import hash_password
from backend.app.models.entities import Business, User
from backend.app.schemas.users import UserOut, UserCreate

router = APIRouter()


@router.get("/me", response_model=UserOut)
def me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # If a business is deactivated by platform admin, users cannot operate.
    # This is the simplest enforcement point for MVP.
    # (Later we can enforce this in a shared dependency for all routes.)
    #
    # Note: we do not leak extra details. We just block access.
    b = db.query(Business).filter(Business.id == current_user.business_id).first()
    if b and (b.is_deleted or not b.is_active):
        raise HTTPException(status_code=403, detail="Business is inactive")
    return UserOut(id=current_user.id, email=pii_decrypt(current_user.email_enc) or "", role=current_user.role)


@router.post("/", response_model=UserOut)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    boss: User = Depends(require_boss),
):
    email_hash = pii_hash(payload.email)
    existing = db.query(User).filter(User.email_hash == email_hash).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    user = User(
        business_id=boss.business_id,
        email_enc=pii_encrypt(payload.email) or "",
        email_hash=email_hash,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut(id=user.id, email=payload.email, role=user.role)
