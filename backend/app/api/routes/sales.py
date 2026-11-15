from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user, require_boss
from backend.app.core.audit import log_audit
from backend.app.core.config import settings
from backend.app.core.db import get_db
from backend.app.core.pii_crypto import pii_encrypt, pii_hash, pii_decrypt
from backend.app.core.push import enqueue_push
from backend.app.core.receipt import render_receipt_html
from backend.app.core.receipt_token import make_receipt_token
from backend.app.models.entities import (
    Business,
    Customer,
    DeviceToken,
    LedgerEntry,
    LedgerType,
    PaymentMethod,
    Product,
    ProductUnit,
    Sale,
    SaleItem,
    SalePayment,
    StockBatch,
    User,
    UserRole,
)
from backend.app.schemas.sales import (
    DraftUpsert,
    SaleCreate,
    SaleItemCreate,
    SaleItemUpdate,
    SalePaymentCreate,
    SaleShareRequest,
)

router = APIRouter()


def _fmt_qty(qty: float) -> str:
    return str(int(qty)) if float(qty).is_integer() else f"{float(qty):g}"


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Shared helpers (used by create, draft checkout, and post-sale edits)
# ---------------------------------------------------------------------------

def _resolve_customer(db: Session, user: User, customer_id: int | None, customer_name: str | None) -> tuple[int | None, str | None]:
    """Find-or-create a customer by name. Returns (customer_id, customer_name)."""
    name = (customer_name or "").strip() or None
    if not customer_id and name:
        name_hash = pii_hash(name)
        existing = (
            db.query(Customer)
            .filter(Customer.business_id == user.business_id, Customer.name_hash == name_hash)
            .first()
        )
        if existing:
            customer_id = existing.id
        else:
            new_customer = Customer(business_id=user.business_id, name_enc=pii_encrypt(name) or "", name_hash=name_hash)
            db.add(new_customer)
            db.flush()
            customer_id = new_customer.id
    if customer_id and not name:
        cust = db.query(Customer).filter(Customer.id == customer_id).first()
        if cust:
            name = pii_decrypt(cust.name_enc)
    return customer_id, name


def _load_units(db: Session, user: User, product_ids: set[int]):
    all_units = (
        db.query(ProductUnit)
        .filter(ProductUnit.business_id == user.business_id, ProductUnit.product_id.in_(product_ids))
        .all()
    ) if product_ids else []
    unit_by_name = {(u.product_id, u.name): u for u in all_units}
    base_unit_by_product = {u.product_id: u for u in all_units if u.is_base}
    return unit_by_name, base_unit_by_product


def _resolve_line(db, user, item, unit_by_name, base_unit_by_product, product_default_units) -> tuple[int, Decimal, Decimal, str | None]:
    """Validate one line and return (base_qty_int, qty, unit_price, display_unit)."""
    qty = Decimal(str(item.quantity))
    if qty <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be > 0")

    unit_name = (item.unit or "").strip() or None
    if unit_name:
        unit_row = unit_by_name.get((item.product_id, unit_name))
        if not unit_row:
            # Accept the product's own unit word (e.g. "kg") — it's not a
            # ProductUnit row, it just means base quantity. Drafts store this
            # as display_unit and resubmit it.
            if unit_name == product_default_units.get(item.product_id):
                unit_row = base_unit_by_product.get(item.product_id)
                factor = Decimal(unit_row.factor_to_base) if unit_row else Decimal(1)
            else:
                raise HTTPException(status_code=400, detail=f"Unknown unit: {unit_name}")
        else:
            factor = Decimal(unit_row.factor_to_base)
    else:
        unit_row = base_unit_by_product.get(item.product_id)
        factor = Decimal(unit_row.factor_to_base) if unit_row else Decimal(1)

    if item.unit_price is not None:
        price = Decimal(str(item.unit_price))
    elif unit_row and unit_row.selling_price is not None:
        price = Decimal(str(unit_row.selling_price))
    else:
        raise HTTPException(
            status_code=400,
            detail=f"No unit_price provided and no default selling_price set for unit '{unit_name or 'base'}'",
        )

    base_qty = qty * factor
    if base_qty != base_qty.to_integral_value():
        raise HTTPException(status_code=400, detail="Quantity results in fractional base units")

    display_unit = unit_name or (unit_row.name if unit_row else product_default_units.get(item.product_id))
    return int(base_qty), qty, price, display_unit


def _deduct_stock(db: Session, user: User, product_id: int, base_qty: int) -> float | None:
    """FIFO stock deduction (locks rows). Returns average cost per base unit."""
    stock_filter = [
        StockBatch.business_id == user.business_id,
        StockBatch.product_id == product_id,
        StockBatch.quantity > 0,
    ]
    if user.branch_id:
        stock_filter.append(or_(StockBatch.branch_id == user.branch_id, StockBatch.branch_id.is_(None)))
    batches = (
        db.query(StockBatch)
        .filter(*stock_filter)
        .order_by(StockBatch.expiry_date.asc().nulls_last(), StockBatch.id.asc())
        .with_for_update()
        .all()
    )
    remaining = base_qty
    cost = 0.0
    for batch in batches:
        if remaining <= 0:
            break
        take = min(batch.quantity, remaining)
        batch.quantity -= take
        remaining -= take
        cost += take * float(batch.cost_price or 0)
    if remaining > 0:
        available = base_qty - remaining
        product = db.query(Product.name).filter(Product.id == product_id).first()
        name = product[0] if product else f"#{product_id}"
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock for {name}: only {available} available to you (needed {base_qty}). Stock may belong to another branch.",
        )
    return round(cost / base_qty, 2) if base_qty > 0 else None


def _restore_stock(db: Session, user: User, product_id: int, qty: int) -> None:
    """Put stock back onto the most recent batch (or create one if none)."""
    latest = (
        db.query(StockBatch)
        .filter(StockBatch.business_id == user.business_id, StockBatch.product_id == product_id)
        .order_by(StockBatch.id.desc())
        .with_for_update()
        .first()
    )
    if latest:
        latest.quantity += qty
    else:
        db.add(StockBatch(business_id=user.business_id, product_id=product_id, branch_id=user.branch_id, quantity=qty, cost_price=0))


def _add_items(db: Session, user: User, sale: Sale, items, *, deduct: bool) -> tuple[Decimal, dict[int, str]]:
    """Create SaleItems for `items`. Deducts stock when `deduct` is True (paid sales);
    drafts only reserve nothing. Returns (sum_of_lines, product_names)."""
    product_ids = {i.product_id for i in items}
    product_rows = (
        db.query(Product.id, Product.name, Product.unit)
        .filter(Product.business_id == user.business_id, Product.id.in_(product_ids))
        .all()
    ) if product_ids else []
    product_names = {p.id: p.name for p in product_rows}
    product_default_units = {p.id: p.unit for p in product_rows}
    missing = product_ids - set(product_names)
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown product id(s): {sorted(missing)}")

    unit_by_name, base_unit_by_product = _load_units(db, user, product_ids)

    total = Decimal("0")
    for item in items:
        base_qty, qty, price, display_unit = _resolve_line(db, user, item, unit_by_name, base_unit_by_product, product_default_units)
        line_total = qty * price
        total += line_total
        sale_item = SaleItem(
            business_id=user.business_id,
            branch_id=sale.branch_id,
            sale_id=sale.id,
            product_id=item.product_id,
            quantity=base_qty,
            display_unit=display_unit,
            display_quantity=float(qty),
            unit_price=float(price),
            line_total=float(line_total),
        )
        if deduct:
            sale_item.cost_price = _deduct_stock(db, user, item.product_id, base_qty)
        db.add(sale_item)
    return total, product_names


def _credit_ledger(db: Session, user: User, sale: Sale, amount: float, note: str) -> None:
    """Record a change in what the customer owes for a credit sale."""
    if not sale.is_credit or abs(amount) < 0.005:
        return
    party = (pii_decrypt(sale.customer_name_enc) if sale.customer_name_enc else None) or "Unknown"
    db.add(
        LedgerEntry(
            business_id=user.business_id,
            branch_id=sale.branch_id,
            ledger_type=LedgerType.customer,
            party_name_enc=pii_encrypt(party) or "",
            party_name_hash=pii_hash(party),
            customer_id=sale.customer_id,
            amount=float(amount),
            note=note,
        )
    )


def _boss_tokens(db: Session, business_id: int) -> list[str]:
    boss_ids = [u.id for u in db.query(User.id).filter(User.business_id == business_id, User.role == UserRole.boss).all()]
    return [t.token for t in db.query(DeviceToken).filter(DeviceToken.user_id.in_(boss_ids)).all()] if boss_ids else []


def _notify_sale(db, user, sale, items, product_names, total: Decimal, customer_name, background_tasks) -> None:
    tokens = _boss_tokens(db, user.business_id)
    labels = [f"{_fmt_qty(i.quantity)}x {product_names.get(i.product_id, f'Product #{i.product_id}')}" for i in items]
    items_text = ", ".join(labels[:3]) + (f" +{len(labels) - 3} more" if len(labels) > 3 else "")
    if sale.is_credit:
        enqueue_push(background_tasks, tokens, title="New Credit Sale",
                     body=f"{items_text} - {float(total):,.2f} on credit" + (f" ({customer_name})" if customer_name else ""))
    else:
        enqueue_push(background_tasks, tokens, title="Sale made", body=f"{items_text} - {float(total):,.2f}")

    for pid in {i.product_id for i in items}:
        total_stock = db.query(func.sum(StockBatch.quantity)).filter(
            StockBatch.business_id == user.business_id, StockBatch.product_id == pid
        ).scalar() or 0
        name = product_names.get(pid, f"Product #{pid}")
        if total_stock == 0:
            enqueue_push(background_tasks, tokens, title="Stock Alert", body=f"{name} is out of stock!")
        elif total_stock <= 10:
            enqueue_push(background_tasks, tokens, title="Stock Alert", body=f"{name} is low on stock ({total_stock} left).")


def _finalize_sale(db, user, sale: Sale, payload: SaleCreate, background_tasks, *, action: str) -> dict:
    """Turn `sale` (new or draft) into a completed, paid sale."""
    customer_id, customer_name = _resolve_customer(db, user, payload.customer_id, payload.customer_name)
    sale.customer_id = customer_id
    sale.customer_name_enc = pii_encrypt(customer_name) if customer_name else None
    sale.payment_method = payload.payment_method
    sale.is_credit = payload.is_credit
    sale.due_date = payload.due_date
    sale.status = "paid"
    sale.created_at = _now()
    sale.updated_at = sale.created_at

    total, product_names = _add_items(db, user, sale, payload.items, deduct=True)
    sale.total_amount = float(total)

    if payload.is_credit:
        _credit_ledger(db, user, sale, float(total), "Credit sale")
    else:
        db.add(SalePayment(
            business_id=user.business_id, sale_id=sale.id, created_by_user_id=user.id,
            method=payload.payment_method, amount=float(total),
        ))

    log_audit(
        db=db, business_id=user.business_id, user_id=user.id, action=action, resource="Sale", resource_id=sale.id,
        details={"total_amount": float(total), "is_credit": payload.is_credit, "items_count": len(payload.items)},
    )
    db.commit()
    _notify_sale(db, user, sale, payload.items, product_names, total, customer_name, background_tasks)
    return {"id": sale.id, "total_amount": float(total), "due_date": sale.due_date.isoformat() if sale.due_date else None}


def _can_edit(sale: Sale, user: User) -> None:
    if sale.is_voided:
        raise HTTPException(status_code=400, detail="This sale is voided and cannot be edited")
    if sale.status != "paid":
        raise HTTPException(status_code=400, detail="Only completed sales can be edited here")
    if sale.created_by_user_id != user.id and user.role != UserRole.boss:
        raise HTTPException(status_code=403, detail="Only the cashier who made this sale or a boss can edit it")


def _get_sale(db: Session, user: User, sale_id: int) -> Sale:
    sale = db.query(Sale).filter(Sale.id == sale_id, Sale.business_id == user.business_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    return sale


def _sale_detail(db: Session, user: User, sale: Sale) -> dict:
    rows = (
        db.query(SaleItem, Product.name)
        .join(Product, Product.id == SaleItem.product_id)
        .filter(SaleItem.sale_id == sale.id)
        .order_by(SaleItem.id.asc())
        .all()
    )
    payments = db.query(SalePayment).filter(SalePayment.sale_id == sale.id).order_by(SalePayment.id.asc()).all()
    paid_total = sum(float(p.amount) for p in payments)
    customer_phone = None
    if sale.customer_id:
        c = db.query(Customer).filter(Customer.id == sale.customer_id).first()
        customer_phone = pii_decrypt(c.phone_enc) if c and c.phone_enc else None
    return {
        "sale_id": sale.id,
        "status": sale.status,
        "is_voided": sale.is_voided,
        "total_amount": float(sale.total_amount),
        "payment_method": sale.payment_method.value,
        "is_credit": sale.is_credit,
        "due_date": sale.due_date.isoformat() if sale.due_date else None,
        "customer_id": sale.customer_id,
        "customer_name": pii_decrypt(sale.customer_name_enc) if sale.customer_name_enc else None,
        "customer_phone": customer_phone,
        "created_at": sale.created_at.isoformat(),
        "updated_at": sale.updated_at.isoformat() if sale.updated_at else None,
        "created_by_user_id": sale.created_by_user_id,
        "can_edit": (not sale.is_voided) and sale.status == "paid" and (sale.created_by_user_id == user.id or user.role == UserRole.boss),
        "paid_total": paid_total,
        "balance_due": max(0.0, float(sale.total_amount) - paid_total) if not sale.is_credit else 0.0,
        "items": [
            {
                "id": si.id,
                "product_id": si.product_id,
                "product_name": name or f"Product #{si.product_id}",
                "quantity": si.display_quantity or si.quantity,
                "unit": si.display_unit or "unit",
                "unit_price": float(si.unit_price),
                "line_total": float(si.line_total),
            }
            for si, name in rows
        ],
        "payments": [
            {"id": p.id, "method": p.method.value, "amount": float(p.amount), "created_at": p.created_at.isoformat() if p.created_at else None}
            for p in payments
        ],
    }


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

@router.post("/")
def create_sale(
    payload: SaleCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.is_credit and not payload.customer_name and not payload.customer_id:
        raise HTTPException(status_code=400, detail="customer_name or customer_id is required for credit sale")
    if not payload.items:
        raise HTTPException(status_code=400, detail="Add at least one item")
    try:
        sale = Sale(
            business_id=user.business_id, branch_id=user.branch_id, created_by_user_id=user.id,
            payment_method=payload.payment_method, is_credit=payload.is_credit, total_amount=0, status="paid",
        )
        db.add(sale)
        db.flush()
        return _finalize_sale(db, user, sale, payload, background_tasks, action="create_sale")
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create sale") from e


# ---------------------------------------------------------------------------
# Drafts (open carts / tabs). No stock is deducted until checkout.
# ---------------------------------------------------------------------------

@router.get("/drafts")
def list_drafts(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Sale).filter(Sale.business_id == user.business_id, Sale.status == "draft", Sale.is_voided == False)  # noqa: E712
    if user.branch_id is not None:
        q = q.filter(or_(Sale.branch_id == user.branch_id, Sale.branch_id.is_(None)))
    drafts = q.order_by(Sale.updated_at.desc().nulls_last(), Sale.id.desc()).limit(50).all()
    return [_sale_detail(db, user, d) for d in drafts]


@router.post("/drafts")
def upsert_draft(
    payload: DraftUpsert,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create or update a draft cart. Called automatically by the Sell page as the
    cashier adds items, so an unfinished sale survives a page refresh or a
    switch to another customer."""
    try:
        if payload.id:
            sale = _get_sale(db, user, payload.id)
            if sale.status != "draft":
                raise HTTPException(status_code=400, detail="This sale is no longer a draft")
            db.query(SaleItem).filter(SaleItem.sale_id == sale.id).delete()
        else:
            sale = Sale(
                business_id=user.business_id, branch_id=user.branch_id, created_by_user_id=user.id,
                payment_method=PaymentMethod.cash, is_credit=False, total_amount=0, status="draft",
            )
            db.add(sale)
            db.flush()

        customer_id, customer_name = _resolve_customer(db, user, None, payload.customer_name) if payload.customer_name else (None, None)
        sale.customer_id = customer_id
        sale.customer_name_enc = pii_encrypt(customer_name) if customer_name else None
        total, _ = _add_items(db, user, sale, payload.items, deduct=False) if payload.items else (Decimal("0"), {})
        sale.total_amount = float(total)
        sale.updated_at = _now()
        db.commit()
        return {"id": sale.id, "total_amount": float(total), "updated_at": sale.updated_at.isoformat(), "items_count": len(payload.items)}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save draft") from e


@router.delete("/drafts/{sale_id}")
def delete_draft(
    sale_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sale = _get_sale(db, user, sale_id)
    if sale.status != "draft":
        raise HTTPException(status_code=400, detail="Only drafts can be discarded")
    db.query(SaleItem).filter(SaleItem.sale_id == sale.id).delete()
    db.delete(sale)
    db.commit()
    return {"ok": True}


@router.post("/drafts/{sale_id}/checkout")
def checkout_draft(
    sale_id: int,
    payload: SaleCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Turn a draft into a paid sale. The final cart is sent again so any last
    edits in the UI are applied; stock is deducted now."""
    if payload.is_credit and not payload.customer_name and not payload.customer_id:
        raise HTTPException(status_code=400, detail="customer_name or customer_id is required for credit sale")
    if not payload.items:
        raise HTTPException(status_code=400, detail="Add at least one item")
    try:
        sale = _get_sale(db, user, sale_id)
        if sale.status != "draft":
            raise HTTPException(status_code=400, detail="This sale was already completed")
        db.query(SaleItem).filter(SaleItem.sale_id == sale.id).delete()
        db.flush()
        return _finalize_sale(db, user, sale, payload, background_tasks, action="checkout_draft")
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to complete sale") from e


# ---------------------------------------------------------------------------
# Edit a completed sale (add items, change price, remove items, extra payment)
# ---------------------------------------------------------------------------

@router.post("/{sale_id}/items")
def add_sale_item(
    sale_id: int,
    payload: SaleItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        sale = _get_sale(db, user, sale_id)
        _can_edit(sale, user)
        total, product_names = _add_items(db, user, sale, [payload], deduct=True)
        sale.total_amount = float(sale.total_amount) + float(total)
        sale.updated_at = _now()
        _credit_ledger(db, user, sale, float(total), f"Item added to sale #{sale.id}")
        log_audit(db=db, business_id=user.business_id, user_id=user.id, action="sale_add_item", resource="Sale", resource_id=sale.id,
                  details={"product_id": payload.product_id, "quantity": payload.quantity, "line_total": float(total)})
        db.commit()
        return _sale_detail(db, user, sale)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to add item") from e


@router.patch("/{sale_id}/items/{item_id}")
def update_sale_item(
    sale_id: int,
    item_id: int,
    payload: SaleItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        sale = _get_sale(db, user, sale_id)
        _can_edit(sale, user)
        item = db.query(SaleItem).filter(SaleItem.id == item_id, SaleItem.sale_id == sale.id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        if payload.unit_price is None or payload.unit_price < 0:
            raise HTTPException(status_code=400, detail="unit_price is required")
        old_line = float(item.line_total)
        qty = Decimal(str(item.display_quantity or item.quantity))
        new_line = float(qty * Decimal(str(payload.unit_price)))
        item.unit_price = float(payload.unit_price)
        item.line_total = new_line
        sale.total_amount = float(sale.total_amount) - old_line + new_line
        sale.updated_at = _now()
        _credit_ledger(db, user, sale, new_line - old_line, f"Price changed on sale #{sale.id}")
        log_audit(db=db, business_id=user.business_id, user_id=user.id, action="sale_update_item", resource="Sale", resource_id=sale.id,
                  details={"item_id": item.id, "old_line_total": old_line, "new_line_total": new_line})
        db.commit()
        return _sale_detail(db, user, sale)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update item") from e


@router.delete("/{sale_id}/items/{item_id}")
def remove_sale_item(
    sale_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        sale = _get_sale(db, user, sale_id)
        _can_edit(sale, user)
        item = db.query(SaleItem).filter(SaleItem.id == item_id, SaleItem.sale_id == sale.id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        count = db.query(func.count(SaleItem.id)).filter(SaleItem.sale_id == sale.id).scalar() or 0
        if count <= 1:
            raise HTTPException(status_code=400, detail="A sale must keep at least one item. Void the sale instead.")
        line = float(item.line_total)
        _restore_stock(db, user, item.product_id, item.quantity)
        db.delete(item)
        sale.total_amount = float(sale.total_amount) - line
        sale.updated_at = _now()
        _credit_ledger(db, user, sale, -line, f"Item removed from sale #{sale.id}")
        log_audit(db=db, business_id=user.business_id, user_id=user.id, action="sale_remove_item", resource="Sale", resource_id=sale.id,
                  details={"item_id": item_id, "line_total": line})
        db.commit()
        return _sale_detail(db, user, sale)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to remove item") from e


@router.post("/{sale_id}/payments")
def add_sale_payment(
    sale_id: int,
    payload: SalePaymentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        sale = _get_sale(db, user, sale_id)
        _can_edit(sale, user)
        if sale.is_credit:
            raise HTTPException(status_code=400, detail="Credit sales are paid through the customer ledger")
        if payload.amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be > 0")
        paid = db.query(func.coalesce(func.sum(SalePayment.amount), 0)).filter(SalePayment.sale_id == sale.id).scalar() or 0
        balance = float(sale.total_amount) - float(paid)
        if payload.amount > balance + 0.005:
            raise HTTPException(status_code=400, detail=f"Amount exceeds balance due ({balance:,.0f})")
        db.add(SalePayment(business_id=user.business_id, sale_id=sale.id, created_by_user_id=user.id,
                           method=payload.method, amount=float(payload.amount), note=payload.note))
        sale.updated_at = _now()
        log_audit(db=db, business_id=user.business_id, user_id=user.id, action="sale_add_payment", resource="Sale", resource_id=sale.id,
                  details={"amount": float(payload.amount), "method": payload.method.value})
        db.commit()
        return _sale_detail(db, user, sale)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to record payment") from e


@router.post("/{sale_id}/void")
def void_sale(
    sale_id: int,
    background_tasks: BackgroundTasks,
    reason: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sale = (
        db.query(Sale)
        .filter(Sale.id == sale_id)
        .filter(Sale.business_id == user.business_id)
        .first()
    )
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    if sale.is_voided:
        raise HTTPException(status_code=400, detail="Sale is already voided")

    if sale.status == "draft":
        raise HTTPException(status_code=400, detail="Drafts are discarded, not voided")

    if sale.created_by_user_id != user.id and user.role != UserRole.boss:
        raise HTTPException(status_code=403, detail="Only the sale creator or a boss can void this sale")

    try:
        items = (
            db.query(SaleItem)
            .filter(SaleItem.sale_id == sale.id)
            .all()
        )

        # 1. Restore stock: add back the deducted quantity to the most recent batch per product
        product_qty: dict[int, int] = {}
        for item in items:
            product_qty[item.product_id] = product_qty.get(item.product_id, 0) + item.quantity

        for pid, qty in product_qty.items():
            latest_batch = (
                db.query(StockBatch)
                .filter(
                    StockBatch.business_id == user.business_id,
                    StockBatch.product_id == pid,
                )
                .order_by(StockBatch.id.desc())
                .with_for_update()
                .first()
            )
            if latest_batch:
                latest_batch.quantity += qty
            else:
                new_batch = StockBatch(
                    business_id=user.business_id,
                    product_id=pid,
                    branch_id=user.branch_id,
                    quantity=qty,
                    cost_price=0,
                )
                db.add(new_batch)

        # 2. If credit sale, create negative ledger entry to reverse the debt
        if sale.is_credit and sale.customer_name_enc:
            customer_name = pii_decrypt(sale.customer_name_enc) or "Unknown"
            reversal = LedgerEntry(
                business_id=user.business_id,
                branch_id=user.branch_id,
                ledger_type=LedgerType.customer,
                party_name_enc=sale.customer_name_enc,
                party_name_hash=pii_hash(customer_name),
                amount=-float(sale.total_amount),
                note=f"Sale voided (sale_id={sale.id}): {reason}",
            )
            db.add(reversal)

        # 3. Mark sale as voided with tracking info
        sale.is_voided = True
        sale.status = "voided"
        sale.voided_by_user_id = user.id
        sale.voided_at = datetime.now(timezone.utc)
        sale.void_reason = reason

        # 4. Audit log
        log_audit(
            db=db,
            business_id=user.business_id,
            user_id=user.id,
            action="void_sale",
            resource="Sale",
            resource_id=sale.id,
            details={"reason": reason, "total_amount": float(sale.total_amount), "voided_by": user.id},
        )
        db.commit()

        # 5. Push notification to all boss users (best-effort, after commit)
        boss_users = (
            db.query(User)
            .filter(User.business_id == user.business_id)
            .filter(User.role == UserRole.boss)
            .all()
        )
        boss_ids = [b.id for b in boss_users]
        tokens = (
            [t.token for t in db.query(DeviceToken).filter(DeviceToken.user_id.in_(boss_ids)).all()]
            if boss_ids
            else []
        )
        enqueue_push(
            background_tasks,
            tokens,
            title="Sale Voided",
            body=f"Sale #{sale.id} (RWF {float(sale.total_amount):.2f}) was voided by user #{user.id}. Reason: {reason or 'N/A'}",
        )

        return {"ok": True, "sale_id": sale.id, "voided": True, "voided_by": user.id}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to void sale") from e


@router.get("/voided")
def list_voided_sales(
    user_id: int | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    boss: User = Depends(require_boss),
):
    q = (
        db.query(Sale)
        .filter(Sale.business_id == boss.business_id)
        .filter(Sale.is_voided == True)  # noqa: E712
    )
    if boss.branch_id is not None:
        q = q.filter(Sale.branch_id == boss.branch_id)
    if user_id:
        q = q.filter(Sale.voided_by_user_id == user_id)
    if start_date:
        q = q.filter(Sale.voided_at >= start_date)
    if end_date:
        q = q.filter(Sale.voided_at <= end_date)

    sales = q.order_by(Sale.voided_at.desc()).all()

    result = []
    for s in sales:
        voided_by = db.query(User).filter(User.id == s.voided_by_user_id).first()
        result.append({
            "sale_id": s.id,
            "total_amount": float(s.total_amount),
            "payment_method": s.payment_method.value,
            "is_credit": s.is_credit,
            "voided_by_user_id": s.voided_by_user_id,
            "voided_by_email": pii_decrypt(voided_by.email_enc) if voided_by else None,
            "voided_at": s.voided_at.isoformat() if s.voided_at else None,
            "void_reason": s.void_reason,
            "created_at": s.created_at.isoformat(),
        })

    return result


@router.get("/recent")
def recent_sales(
    limit: int = 20,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sales_q = (
        db.query(Sale)
        .filter(Sale.business_id == user.business_id)
        .filter(Sale.is_voided == False)  # noqa: E712
        .filter(Sale.status == "paid")
    )
    if user.branch_id is not None:
        sales_q = sales_q.filter(Sale.branch_id == user.branch_id)
    sales = (
        sales_q
        .order_by(Sale.created_at.desc())
        .limit(limit)
        .all()
    )

    sale_ids = [s.id for s in sales]
    items_by_sale: dict[int, list[dict]] = {}
    if sale_ids:
        rows = (
            db.query(SaleItem, Product.name)
            .join(Product, Product.id == SaleItem.product_id)
            .filter(SaleItem.business_id == user.business_id)
            .filter(SaleItem.sale_id.in_(sale_ids))
            .all()
        )
        for si, product_name in rows:
            items_by_sale.setdefault(si.sale_id, []).append(
                {
                    "product_id": si.product_id,
                    "product_name": product_name or f"Product #{si.product_id}",
                    "quantity": si.display_quantity or si.quantity,
                    "unit": si.display_unit or "unit",
                    "unit_price": float(si.unit_price),
                    "line_total": float(si.line_total),
                }
            )

    customer_ids = {s.customer_id for s in sales if s.customer_id}
    phones_by_customer: dict[int, str | None] = {}
    if customer_ids:
        for c in db.query(Customer).filter(Customer.id.in_(customer_ids)).all():
            phones_by_customer[c.id] = pii_decrypt(c.phone_enc) if c.phone_enc else None

    paid_by_sale: dict[int, float] = {}
    if sale_ids:
        for sid, amt in (
            db.query(SalePayment.sale_id, func.coalesce(func.sum(SalePayment.amount), 0))
            .filter(SalePayment.sale_id.in_(sale_ids))
            .group_by(SalePayment.sale_id)
            .all()
        ):
            paid_by_sale[sid] = float(amt)

    result = []
    for s in sales:
        customer_name = pii_decrypt(s.customer_name_enc) if s.customer_name_enc else None
        items = items_by_sale.get(s.id, [])
        paid_total = paid_by_sale.get(s.id, float(s.total_amount) if not s.is_credit else 0.0)
        result.append({
            "sale_id": s.id,
            "status": s.status,
            "total_amount": float(s.total_amount),
            "payment_method": s.payment_method.value,
            "is_credit": s.is_credit,
            "customer_name": customer_name,
            "customer_id": s.customer_id,
            "customer_phone": phones_by_customer.get(s.customer_id) if s.customer_id else None,
            "created_at": s.created_at.isoformat(),
            "created_by_user_id": s.created_by_user_id,
            "items_count": len(items),
            "items": items,
            "paid_total": paid_total,
            "balance_due": 0.0 if s.is_credit else max(0.0, float(s.total_amount) - paid_total),
            "can_edit": s.created_by_user_id == user.id or user.role == UserRole.boss,
        })

    return result


@router.get("/{sale_id}/receipt", response_class=HTMLResponse)
def get_receipt(
    sale_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sale = (
        db.query(Sale)
        .filter(Sale.id == sale_id)
        .filter(Sale.business_id == user.business_id)
        .first()
    )
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    if sale.status == "draft":
        raise HTTPException(status_code=400, detail="Drafts do not have a receipt yet")
    business = db.query(Business).filter(Business.id == user.business_id).first()
    return render_receipt_html(db, sale, business)


@router.post("/{sale_id}/share")
def share_sale(
    sale_id: int,
    payload: SaleShareRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Prepare a WhatsApp share: returns a public receipt link + summary.

    If a phone number is given it is saved on the customer so it's prefilled next time.
    """
    sale = (
        db.query(Sale)
        .filter(Sale.id == sale_id)
        .filter(Sale.business_id == user.business_id)
        .first()
    )
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    if sale.status == "draft" or sale.is_voided:
        raise HTTPException(status_code=400, detail="Only completed sales can be shared")

    phone = (payload.phone or "").strip() or None
    if phone:
        customer = None
        if sale.customer_id:
            customer = db.query(Customer).filter(Customer.id == sale.customer_id).first()
        elif sale.customer_name_enc:
            name = pii_decrypt(sale.customer_name_enc)
            if name:
                customer = Customer(
                    business_id=user.business_id,
                    name_enc=sale.customer_name_enc,
                    name_hash=pii_hash(name),
                )
                db.add(customer)
                db.flush()
                sale.customer_id = customer.id
        if customer:
            customer.phone_enc = pii_encrypt(phone)
            customer.phone_hash = pii_hash(phone)
        db.commit()

    business = db.query(Business).filter(Business.id == user.business_id).first()
    items = (
        db.query(SaleItem, Product.name)
        .join(Product, Product.id == SaleItem.product_id)
        .filter(SaleItem.sale_id == sale.id)
        .all()
    )
    token = make_receipt_token(sale.id)
    base = str(settings.public_api_url or "").rstrip("/")
    return {
        "sale_id": sale.id,
        "token": token,
        "receipt_url": f"{base}/api/public/receipt/{token}",
        "business_name": business.name,
        "total_amount": float(sale.total_amount),
        "customer_name": pii_decrypt(sale.customer_name_enc) if sale.customer_name_enc else None,
        "items": [
            {
                "name": name,
                "quantity": si.display_quantity or si.quantity,
                "unit": si.display_unit or "",
                "line_total": float(si.line_total),
            }
            for si, name in items
        ],
    }


@router.get("/customers")
def search_customers(
    search: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return customer name suggestions across the whole business for RFM/autocomplete."""
    customers = (
        db.query(Customer)
        .filter(Customer.business_id == user.business_id)
        .all()
    )
    names = []
    for c in customers:
        if c.name_enc:
            name = pii_decrypt(c.name_enc)
            if name:
                names.append(name)

    if search:
        q = search.lower()
        names = [n for n in names if q in n.lower()]

    seen = set()
    result = []
    for n in names:
        if n not in seen:
            seen.add(n)
            result.append(n)
            if len(result) >= 10:
                break
    return {"customers": result}


# Declared last: /{sale_id} would otherwise swallow /customers, /recent, /voided, /drafts.
@router.get("/{sale_id}")
def sale_detail(
    sale_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sale = _get_sale(db, user, sale_id)
    if user.branch_id is not None and sale.branch_id not in (None, user.branch_id):
        raise HTTPException(status_code=404, detail="Sale not found")
    return _sale_detail(db, user, sale)
