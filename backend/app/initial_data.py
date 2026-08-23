from sqlalchemy.orm import Session

from backend.app.core.pii_crypto import pii_encrypt, pii_hash
from backend.app.core.security import hash_password
from backend.app.models.entities import Business, Branch, User, UserRole


def seed(db: Session):
    business = Business(name="Demo Shop")
    db.add(business)
    db.flush()

    branch = Branch(business_id=business.id, name="Main Branch")
    db.add(branch)
    db.flush()

    boss = User(
        business_id=business.id,
        branch_id=branch.id,
        email_enc=pii_encrypt("boss@example.com") or "",
        email_hash=pii_hash("boss@example.com"),
        password_hash=hash_password("ChangeMe123!"),
        role=UserRole.boss,
    )
    db.add(boss)
    db.commit()
