from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user, require_boss
from backend.app.core.db import get_db
from backend.app.core.audit import log_audit
from backend.app.core.pii_crypto import pii_decrypt, pii_encrypt, pii_hash
from backend.app.core.security import hash_password
from backend.app.core.storage import upload_logo as upload_to_supabase
from backend.app.models.entities import Business, User, UserRole
from backend.app.schemas.users import UserOut, UserCreate, UserSelfUpdate, BusinessUpdate

router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
MAX_LOGO_SIZE = 2 * 1024 * 1024  # 2MB


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
    return UserOut(
        id=current_user.id,
        email=pii_decrypt(current_user.email_enc) or "",
        role=current_user.role,
        branch_id=current_user.branch_id,
        is_active=current_user.is_active,
        business_name=b.name if b else None,
        business_logo_url=b.logo_url if b else None,
        business_phone=pii_decrypt(b.phone_enc) if b and b.phone_enc else None,
    )


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserSelfUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.email is not None:
        email_hash = pii_hash(payload.email)
        existing = (
            db.query(User)
            .filter(User.business_id == current_user.business_id)
            .filter(User.email_hash == email_hash)
            .filter(User.is_active == True)
            .filter(User.id != current_user.id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=409, detail="Email already in use")
        current_user.email_enc = pii_encrypt(payload.email) or ""
        current_user.email_hash = email_hash
    if payload.password is not None:
        current_user.password_hash = hash_password(payload.password)
    db.commit()
    db.refresh(current_user)
    log_audit(
        db=db,
        business_id=current_user.business_id,
        user_id=current_user.id,
        action="update_profile",
        resource="User",
        resource_id=current_user.id,
        details={
            "email_changed": payload.email is not None,
            "password_changed": payload.password is not None,
        },
    )
    b = db.query(Business).filter(Business.id == current_user.business_id).first()
    return UserOut(
        id=current_user.id,
        email=pii_decrypt(current_user.email_enc) or "",
        role=current_user.role,
        branch_id=current_user.branch_id,
        is_active=current_user.is_active,
        business_name=b.name if b else None,
        business_logo_url=b.logo_url if b else None,
        business_phone=pii_decrypt(b.phone_enc) if b and b.phone_enc else None,
    )


@router.post("/", response_model=UserOut)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    boss: User = Depends(require_boss),
):
    email_hash = pii_hash(payload.email)
    existing = db.query(User).filter(User.email_hash == email_hash, User.is_active == True).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    # Branch permission logic:
    # - Super boss (branch_id=NULL): can assign to any branch or leave unassigned
    # - Branch boss (branch_id=X): can only create users for their own branch
    if boss.branch_id is not None:
        if payload.branch_id is not None and payload.branch_id != boss.branch_id:
            raise HTTPException(status_code=403, detail="You can only create users for your own branch")
        if payload.role == UserRole.boss:
            raise HTTPException(status_code=403, detail="Only the super boss can create boss users")
        target_branch = boss.branch_id
    else:
        target_branch = payload.branch_id

    user = User(
        business_id=boss.business_id,
        branch_id=target_branch,
        email_enc=pii_encrypt(payload.email) or "",
        email_hash=email_hash,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.flush()

    log_audit(
        db=db,
        business_id=boss.business_id,
        user_id=boss.id,
        action="create_user",
        resource="User",
        resource_id=user.id,
        details={"email": payload.email, "role": user.role.value, "branch_id": target_branch}
    )
    db.commit()
    db.refresh(user)

    return UserOut(id=user.id, email=payload.email, role=user.role, branch_id=user.branch_id, is_active=user.is_active)


@router.get("/", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    boss: User = Depends(require_boss),
):
    q = db.query(User).filter(User.business_id == boss.business_id)
    if boss.branch_id is not None:
        q = q.filter(User.branch_id == boss.branch_id)
    users = q.order_by(User.id.asc()).all()
    return [
        UserOut(id=u.id, email=pii_decrypt(u.email_enc) or "", role=u.role, branch_id=u.branch_id, is_active=u.is_active)
        for u in users
    ]


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    is_active: bool,
    db: Session = Depends(get_db),
    boss: User = Depends(require_boss),
):
    target = (
        db.query(User)
        .filter(User.id == user_id)
        .filter(User.business_id == boss.business_id)
        .first()
    )
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if boss.branch_id is not None and target.branch_id != boss.branch_id:
        raise HTTPException(status_code=403, detail="You can only manage users in your own branch")

    if target.id == boss.id:
        raise HTTPException(status_code=403, detail="You cannot change your own status")

    target.is_active = is_active
    log_audit(
        db=db,
        business_id=boss.business_id,
        user_id=boss.id,
        action="update_user_status",
        resource="User",
        resource_id=target.id,
        details={"is_active": is_active},
    )
    db.commit()
    db.refresh(target)

    return UserOut(
        id=target.id,
        email=pii_decrypt(target.email_enc) or "",
        role=target.role,
        branch_id=target.branch_id,
        is_active=target.is_active,
    )


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    boss: User = Depends(require_boss),
):
    target = (
        db.query(User)
        .filter(User.id == user_id)
        .filter(User.business_id == boss.business_id)
        .first()
    )
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if boss.branch_id is not None and target.branch_id != boss.branch_id:
        raise HTTPException(status_code=403, detail="You can only manage users in your own branch")

    if target.id == boss.id:
        raise HTTPException(status_code=403, detail="You cannot delete yourself")

    target.is_active = False
    log_audit(
        db=db,
        business_id=boss.business_id,
        user_id=boss.id,
        action="deactivate_user",
        resource="User",
        resource_id=target.id,
        details={},
    )
    db.commit()
    return {"ok": True, "user_id": target.id, "deactivated": True}


@router.patch("/business", response_model=UserOut)
def update_business_settings(
    payload: BusinessUpdate,
    db: Session = Depends(get_db),
    boss: User = Depends(require_boss),
):
    b = db.query(Business).filter(Business.id == boss.business_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")

    if payload.business_name is not None:
        name = payload.business_name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Business name is required")
        b.name = name

    if payload.phone is not None:
        phone = payload.phone.strip()
        if not phone:
            raise HTTPException(status_code=400, detail="Phone number is required")
        b.phone_enc = pii_encrypt(phone)
        b.phone_hash = pii_hash(phone)

    if payload.email is not None:
        email = payload.email
        email_hash = pii_hash(email)
        existing = (
            db.query(User)
            .filter(User.email_hash == email_hash)
            .filter(User.is_active == True)
            .filter(User.id != boss.id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=409, detail="Email already in use")

        boss.email_enc = pii_encrypt(email)
        boss.email_hash = email_hash

    db.commit()
    db.refresh(b)
    db.refresh(boss)

    log_audit(
        db=db,
        business_id=boss.business_id,
        user_id=boss.id,
        action="update_business",
        resource="Business",
        resource_id=b.id,
        details={
            "name_changed": payload.business_name is not None,
            "phone_changed": payload.phone is not None,
            "email_changed": payload.email is not None,
        },
    )
    db.commit()

    return UserOut(
        id=boss.id,
        email=pii_decrypt(boss.email_enc) or "",
        role=boss.role,
        branch_id=boss.branch_id,
        is_active=boss.is_active,
        business_name=b.name,
        business_logo_url=b.logo_url,
    )


@router.post("/logo")
def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    boss: User = Depends(require_boss),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only PNG, JPEG, and WebP images are allowed")

    contents = file.file.read()
    if len(contents) > MAX_LOGO_SIZE:
        raise HTTPException(status_code=400, detail="Logo must be under 2MB")

    ext = file.content_type.split("/")[-1]
    if ext == "jpeg":
        ext = "jpg"
    filename = f"business_{boss.business_id}.{ext}"

    # Try Supabase Storage first
    supabase_url = upload_to_supabase(boss.business_id, contents, file.content_type, ext)

    if supabase_url:
        logo_url = supabase_url
    else:
        # Fallback: local filesystem
        upload_dir = Path(__file__).resolve().parents[4] / "uploads" / "logos"
        upload_dir.mkdir(parents=True, exist_ok=True)
        file_path = upload_dir / filename
        file_path.write_bytes(contents)
        logo_url = f"/uploads/logos/{filename}"

    business = db.query(Business).filter(Business.id == boss.business_id).first()
    business.logo_url = logo_url
    db.commit()

    log_audit(
        db=db,
        business_id=boss.business_id,
        user_id=boss.id,
        action="upload_logo",
        resource="Business",
        resource_id=boss.business_id,
        details={"filename": filename, "storage": "supabase" if supabase_url else "local"},
    )
    db.commit()

    return {"ok": True, "logo_url": business.logo_url}
