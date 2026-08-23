from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user, require_boss, require_super_boss
from backend.app.core.audit import log_audit
from backend.app.core.db import get_db
from backend.app.models.entities import Branch, User
from backend.app.schemas.branches import BranchCreate, BranchOut

router = APIRouter()


@router.post("", response_model=BranchOut)
def create_branch(
    payload: BranchCreate,
    db: Session = Depends(get_db),
    boss: User = Depends(require_super_boss),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Branch name is required")
    existing = db.query(Branch).filter(Branch.business_id == boss.business_id, Branch.name == name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Branch already exists")

    branch = Branch(
        business_id=boss.business_id,
        name=name,
    )
    db.add(branch)
    db.flush()
    log_audit(
        db=db,
        business_id=boss.business_id,
        user_id=boss.id,
        action="create_branch",
        resource="Branch",
        resource_id=branch.id,
        details={"name": branch.name},
    )
    db.commit()
    db.refresh(branch)
    return branch


@router.get("", response_model=list[BranchOut])
def list_branches(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return (
        db.query(Branch)
        .filter(Branch.business_id == user.business_id)
        .order_by(Branch.name)
        .all()
    )
