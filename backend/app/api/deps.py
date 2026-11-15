from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.core.db import get_db
from backend.app.core.subscription import is_subscription_blocked
from backend.app.models.entities import Business, User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    token: str | None = Depends(oauth2_scheme),
) -> User:
    try:
        if not token:
            token = request.cookies.get("access_token")
        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        sub: str | None = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        try:
            user_id = int(sub)
        except (TypeError, ValueError) as e:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from e
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from e

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    business = db.query(Business).filter(Business.id == user.business_id).first()
    if not business or not business.is_active or business.is_deleted:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Business account is inactive")
    if is_subscription_blocked(business):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Subscription expired. Please contact EdeniSystem to renew.")
    return user


def require_boss(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.boss:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Boss role required")
    return user


def require_super_boss(user: User = Depends(require_boss)) -> User:
    if user.branch_id is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super boss role required")
    return user
