from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.core.db import get_db
from backend.app.models.entities import User, Business, Product

from sqlalchemy.exc import OperationalError

router = APIRouter()

@router.get("/stats")
def get_public_stats(db: Session = Depends(get_db)):
    try:
        users = db.query(User).filter(User.is_active == True).count()
        businesses = db.query(Business).filter(Business.is_active == True).count()
        products = db.query(Product).count()

        return {
            "users": users,
            "businesses": businesses,
            "products": products
        }
    except OperationalError:
        # Graceful fallback when the database is unreachable (e.g., paused)
        # Prevents ugly 500 errors and large terminal stack traces.
        return {
            "users": 0,
            "businesses": 0,
            "products": 0
        }
