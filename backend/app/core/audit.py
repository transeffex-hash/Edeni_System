import json
from sqlalchemy.orm import Session
from backend.app.models.entities import AuditLog

def log_audit(
    db: Session, 
    business_id: int, 
    user_id: int, 
    action: str, 
    resource: str, 
    resource_id: int | None = None, 
    details: dict | None = None
):
    try:
        log = AuditLog(
            business_id=business_id,
            user_id=user_id,
            action=action,
            resource=resource,
            resource_id=resource_id,
            details=json.dumps(details) if details else None
        )
        db.add(log)
        # Note: We do not commit here to ensure the audit log is part of the 
        # caller's transaction. It will be saved when the caller commits.
    except Exception:
        pass
