from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user
from backend.app.core.db import get_db
from backend.app.core.pii_crypto import pii_encrypt, pii_hash, pii_decrypt
from backend.app.models.entities import Customer, User
from backend.app.schemas.customers import CustomerCreate, CustomerOut, CustomerAutocomplete

router = APIRouter()


@router.post("", response_model=CustomerOut)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    name_hash = pii_hash(payload.name)
    existing = (
        db.query(Customer)
        .filter(Customer.business_id == user.business_id)
        .filter(Customer.name_hash == name_hash)
        .first()
    )
    if existing:
        return CustomerOut(
            id=existing.id,
            name=pii_decrypt(existing.name_enc) or "",
            phone=pii_decrypt(existing.phone_enc) if existing.phone_enc else None,
        )

    customer = Customer(
        business_id=user.business_id,
        name_enc=pii_encrypt(payload.name) or "",
        name_hash=name_hash,
        phone_enc=pii_encrypt(payload.phone) if payload.phone else None,
        phone_hash=pii_hash(payload.phone) if payload.phone else None,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)

    return CustomerOut(
        id=customer.id,
        name=payload.name,
        phone=payload.phone,
    )


@router.get("/autocomplete", response_model=list[CustomerAutocomplete])
def autocomplete_customers(
    q: str = Query(..., min_length=1, description="Search query for customer name"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    name_hash = pii_hash(q)
    exact = (
        db.query(Customer)
        .filter(Customer.business_id == user.business_id)
        .filter(Customer.name_hash == name_hash)
        .filter(Customer.is_active == True)  # noqa: E712
        .first()
    )
    if exact:
        return [CustomerAutocomplete(
            id=exact.id,
            name=pii_decrypt(exact.name_enc) or "",
            phone=pii_decrypt(exact.phone_enc) if exact.phone_enc else None,
        )]

    all_customers = (
        db.query(Customer)
        .filter(Customer.business_id == user.business_id)
        .filter(Customer.is_active == True)  # noqa: E712
        .all()
    )
    results = []
    q_lower = q.strip().lower()
    for c in all_customers:
        name = pii_decrypt(c.name_enc) or ""
        if q_lower in name.lower():
            results.append(CustomerAutocomplete(
                id=c.id,
                name=name,
                phone=pii_decrypt(c.phone_enc) if c.phone_enc else None,
            ))
    return results


@router.get("", response_model=list[CustomerOut])
def list_customers(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    customers = (
        db.query(Customer)
        .filter(Customer.business_id == user.business_id)
        .filter(Customer.is_active == True)  # noqa: E712
        .order_by(Customer.created_at.desc())
        .all()
    )
    return [
        CustomerOut(
            id=c.id,
            name=pii_decrypt(c.name_enc) or "",
            phone=pii_decrypt(c.phone_enc) if c.phone_enc else None,
        )
        for c in customers
    ]
