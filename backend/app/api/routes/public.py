from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from backend.app.core.db import get_db
from backend.app.core.receipt import render_receipt_html
from backend.app.core.receipt_token import parse_receipt_token
from backend.app.models.entities import User, Business, Product, Sale

from sqlalchemy.exc import OperationalError

router = APIRouter()


@router.get("/receipt/{token}", response_class=HTMLResponse)
def public_receipt(token: str, db: Session = Depends(get_db)):
    """Customer-facing receipt opened from a WhatsApp link. No login required;
    the token is an HMAC signature so links can't be guessed."""
    sale_id = parse_receipt_token(token)
    if sale_id is None:
        raise HTTPException(status_code=404, detail="Receipt not found")
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Receipt not found")
    business = db.query(Business).filter(Business.id == sale.business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return render_receipt_html(db, sale, business, public=True)

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
