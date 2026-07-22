from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user
from backend.app.core.db import get_db
from backend.app.core.pii_crypto import pii_encrypt, pii_hash
from backend.app.core.push import send_push
from backend.app.models.entities import (
    DeviceToken,
    LedgerEntry,
    LedgerType,
    ProductUnit,
    Sale,
    SaleItem,
    StockBatch,
    User,
    UserRole,
)
from backend.app.schemas.sales import SaleCreate

router = APIRouter()


@router.post("/")
def create_sale(
    payload: SaleCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.is_credit and not payload.customer_name:
        raise HTTPException(status_code=400, detail="customer_name is required for credit sale")

    total_amount = sum(i.quantity * i.unit_price for i in payload.items)

    try:
        sale = Sale(
            business_id=user.business_id,
            created_by_user_id=user.id,
            payment_method=payload.payment_method,
            is_credit=payload.is_credit,
            customer_name_enc=pii_encrypt(payload.customer_name),
            total_amount=total_amount,
        )
        db.add(sale)
        db.flush()

        for item in payload.items:
            qty = Decimal(str(item.quantity))
            if qty <= 0:
                raise HTTPException(status_code=400, detail="Quantity must be > 0")

            unit_name = (item.unit or "").strip() or None
            factor = None
            if unit_name:
                u = (
                    db.query(ProductUnit)
                    .filter(ProductUnit.business_id == user.business_id)
                    .filter(ProductUnit.product_id == item.product_id)
                    .filter(ProductUnit.name == unit_name)
                    .first()
                )
                if not u:
                    raise HTTPException(status_code=400, detail=f"Unknown unit: {unit_name}")
                factor = Decimal(u.factor_to_base)
            else:
                base = (
                    db.query(ProductUnit)
                    .filter(ProductUnit.business_id == user.business_id)
                    .filter(ProductUnit.product_id == item.product_id)
                    .filter(ProductUnit.is_base == True)  # noqa: E712
                    .first()
                )
                factor = Decimal(base.factor_to_base) if base else Decimal(1)

            base_qty = qty * factor
            if base_qty != base_qty.to_integral_value():
                raise HTTPException(status_code=400, detail="Quantity results in fractional base units")

            base_qty_int = int(base_qty)
            line_total = float(qty) * item.unit_price
            sale_item = SaleItem(
                business_id=user.business_id,
                sale_id=sale.id,
                product_id=item.product_id,
                quantity=base_qty_int,
                display_unit=unit_name,
                display_quantity=float(qty),
                unit_price=item.unit_price,
                line_total=line_total,
            )
            db.add(sale_item)

            remaining = base_qty_int
            batches = (
                db.query(StockBatch)
                .filter(
                    StockBatch.business_id == user.business_id,
                    StockBatch.product_id == item.product_id,
                    StockBatch.quantity > 0,
                )
                .order_by(StockBatch.expiry_date.asc().nulls_last(), StockBatch.id.asc())
                .with_for_update()
                .all()
            )

            for batch in batches:
                if remaining <= 0:
                    break

                take = min(batch.quantity, remaining)
                batch.quantity -= take
                remaining -= take

            if remaining > 0:
                raise HTTPException(status_code=400, detail="Insufficient stock")

        if payload.is_credit:
            party = payload.customer_name or "Unknown"
            entry = LedgerEntry(
                business_id=user.business_id,
                ledger_type=LedgerType.customer,
                party_name_enc=pii_encrypt(party) or "",
                party_name_hash=pii_hash(party),
                amount=total_amount,
                note="Credit sale",
            )
            db.add(entry)

        db.commit()

        # Boss notification (best-effort):
        # - We notify every boss user in the business on each sale.
        # - If Firebase isn't configured, this does nothing (API still works).
        boss_ids = [
            u.id
            for u in db.query(User)
            .filter(User.business_id == user.business_id)
            .filter(User.role == UserRole.boss)
            .all()
        ]
        tokens = (
            [t.token for t in db.query(DeviceToken).filter(DeviceToken.user_id.in_(boss_ids)).all()]
            if boss_ids
            else []
        )
        send_push(tokens, title="Sale made", body=f"Sale total: {float(total_amount):.2f}")

        return {"id": sale.id, "total_amount": float(total_amount)}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create sale") from e
