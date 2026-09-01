from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user, require_boss
from backend.app.core.audit import log_audit
from backend.app.core.db import get_db
from backend.app.core.pii_crypto import pii_encrypt, pii_hash, pii_decrypt
from backend.app.core.push import enqueue_push
from backend.app.models.entities import (
    Business,
    Customer,
    DeviceToken,
    LedgerEntry,
    LedgerType,
    Product,
    ProductUnit,
    Sale,
    SaleItem,
    StockBatch,
    User,
    UserRole,
)
from backend.app.schemas.sales import SaleCreate

router = APIRouter()


def _fmt_qty(qty: float) -> str:
    return str(int(qty)) if float(qty).is_integer() else f"{float(qty):g}"


@router.post("/")
def create_sale(
    payload: SaleCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.is_credit and not payload.customer_name and not payload.customer_id:
        raise HTTPException(status_code=400, detail="customer_name or customer_id is required for credit sale")

    try:
        # Resolve customer: use provided ID, or find/create by name
        customer_id = payload.customer_id
        customer_name = None
        if not customer_id and payload.customer_name:
            name_hash = pii_hash(payload.customer_name)
            existing = (
                db.query(Customer)
                .filter(Customer.business_id == user.business_id)
                .filter(Customer.name_hash == name_hash)
                .first()
            )
            if existing:
                customer_id = existing.id
            else:
                new_customer = Customer(
                    business_id=user.business_id,
                    name_enc=pii_encrypt(payload.customer_name) or "",
                    name_hash=name_hash,
                )
                db.add(new_customer)
                db.flush()
                customer_id = new_customer.id
            customer_name = payload.customer_name

        if customer_id and not customer_name:
            cust = db.query(Customer).filter(Customer.id == customer_id).first()
            if cust:
                customer_name = pii_decrypt(cust.name_enc)

        sale = Sale(
            business_id=user.business_id,
            branch_id=user.branch_id,
            created_by_user_id=user.id,
            customer_id=customer_id,
            payment_method=payload.payment_method,
            is_credit=payload.is_credit,
            customer_name_enc=pii_encrypt(customer_name) if customer_name else pii_encrypt(payload.customer_name),
            total_amount=0,
            due_date=payload.due_date,
        )
        db.add(sale)
        db.flush()

        total_amount = Decimal("0")

        product_ids = {item.product_id for item in payload.items}

        product_rows = (
            db.query(Product.id, Product.name, Product.unit)
            .filter(Product.business_id == user.business_id)
            .filter(Product.id.in_(product_ids))
            .all()
        )
        product_names: dict[int, str] = {p.id: p.name for p in product_rows}
        product_default_units: dict[int, str | None] = {p.id: p.unit for p in product_rows}

        # Preload product units for all items
        all_units = (
            db.query(ProductUnit)
            .filter(ProductUnit.business_id == user.business_id)
            .filter(ProductUnit.product_id.in_(product_ids))
            .all()
        )
        unit_by_name: dict[tuple[int, str], ProductUnit] = {(u.product_id, u.name): u for u in all_units}
        base_unit_by_product: dict[int, ProductUnit] = {u.product_id: u for u in all_units if u.is_base}

        # Preload stock batches for all items (FIFO) and lock them
        stock_filter = [
            StockBatch.business_id == user.business_id,
            StockBatch.product_id.in_(product_ids),
            StockBatch.quantity > 0,
        ]
        if user.branch_id:
            stock_filter.append(or_(StockBatch.branch_id == user.branch_id, StockBatch.branch_id.is_(None)))
        all_batches = (
            db.query(StockBatch)
            .filter(*stock_filter)
            .order_by(StockBatch.expiry_date.asc().nulls_last(), StockBatch.id.asc())
            .with_for_update()
            .all()
        )
        batches_by_product: dict[int, list[StockBatch]] = {}
        for b in all_batches:
            batches_by_product.setdefault(b.product_id, []).append(b)

        for item in payload.items:
            qty = Decimal(str(item.quantity))
            if qty <= 0:
                raise HTTPException(status_code=400, detail="Quantity must be > 0")

            unit_name = (item.unit or "").strip() or None
            factor = None
            unit_row = None
            if unit_name:
                unit_row = unit_by_name.get((item.product_id, unit_name))
                if not unit_row:
                    raise HTTPException(status_code=400, detail=f"Unknown unit: {unit_name}")
                factor = Decimal(unit_row.factor_to_base)
            else:
                unit_row = base_unit_by_product.get(item.product_id)
                factor = Decimal(unit_row.factor_to_base) if unit_row else Decimal(1)

            # Resolve unit price: use provided price, or fall back to default selling_price
            if item.unit_price is not None:
                resolved_price = Decimal(str(item.unit_price))
            elif unit_row and unit_row.selling_price is not None:
                resolved_price = Decimal(str(unit_row.selling_price))
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"No unit_price provided and no default selling_price set for unit '{unit_name or 'base'}'"
                )

            base_qty = qty * factor
            if base_qty != base_qty.to_integral_value():
                raise HTTPException(status_code=400, detail="Quantity results in fractional base units")

            base_qty_int = int(base_qty)
            line_total = qty * resolved_price
            total_amount += line_total
            sale_item = SaleItem(
                business_id=user.business_id,
                branch_id=sale.branch_id,
                sale_id=sale.id,
                product_id=item.product_id,
                quantity=base_qty_int,
                display_unit=unit_name or (unit_row.name if unit_row else product_default_units.get(item.product_id)),
                display_quantity=float(qty),
                unit_price=float(resolved_price),
                line_total=float(line_total),
            )
            db.add(sale_item)

            remaining = base_qty_int
            item_cost = 0.0
            batches = batches_by_product.get(item.product_id, [])
            for batch in batches:
                if remaining <= 0:
                    break
                if batch.quantity <= 0:
                    continue
                take = min(batch.quantity, remaining)
                batch.quantity -= take
                remaining -= take
                item_cost += take * float(batch.cost_price or 0)

            if remaining > 0:
                raise HTTPException(status_code=400, detail="Insufficient stock")

            sale_item.cost_price = round(item_cost / base_qty_int, 2) if base_qty_int > 0 else None

        sale.total_amount = float(total_amount)

        if payload.is_credit:
            party = customer_name or payload.customer_name or "Unknown"
            entry = LedgerEntry(
                business_id=user.business_id,
                branch_id=user.branch_id,
                ledger_type=LedgerType.customer,
                party_name_enc=pii_encrypt(party) or "",
                party_name_hash=pii_hash(party),
                customer_id=customer_id,
                amount=float(total_amount),
                note="Credit sale",
            )
            db.add(entry)

        log_audit(
            db=db,
            business_id=user.business_id,
            user_id=user.id,
            action="create_sale",
            resource="Sale",
            resource_id=sale.id,
            details={"total_amount": float(total_amount), "is_credit": payload.is_credit, "items_count": len(payload.items)},
        )
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
        item_labels = [
            f"{_fmt_qty(i.quantity)}x {product_names.get(i.product_id, f'Product #{i.product_id}')}"
            for i in payload.items
        ]
        items_text = ", ".join(item_labels[:3])
        if len(item_labels) > 3:
            items_text += f" +{len(item_labels) - 3} more"

        if payload.is_credit:
            enqueue_push(
                background_tasks,
                tokens,
                title="New Credit Sale",
                body=f"{items_text} - {float(total_amount):,.2f} on credit"
                + (f" ({customer_name})" if customer_name else ""),
            )
        else:
            enqueue_push(
                background_tasks,
                tokens,
                title="Sale made",
                body=f"{items_text} - {float(total_amount):,.2f}",
            )

        # Stock alerts
        product_ids = {item.product_id for item in payload.items}
        for pid in product_ids:
            total_stock = db.query(func.sum(StockBatch.quantity)).filter(
                StockBatch.business_id == user.business_id,
                StockBatch.product_id == pid
            ).scalar() or 0
            
            if total_stock == 0:
                enqueue_push(
                    background_tasks,
                    tokens,
                    title="Stock Alert",
                    body=f"{product_names.get(pid, f'Product #{pid}')} is out of stock!",
                )
            elif total_stock <= 10:
                enqueue_push(
                    background_tasks,
                    tokens,
                    title="Stock Alert",
                    body=f"{product_names.get(pid, f'Product #{pid}')} is low on stock ({total_stock} left).",
                )

        return {"id": sale.id, "total_amount": float(total_amount), "due_date": sale.due_date.isoformat() if sale.due_date else None}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create sale") from e


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

    result = []
    for s in sales:
        customer_name = pii_decrypt(s.customer_name_enc) if s.customer_name_enc else None
        items = items_by_sale.get(s.id, [])
        result.append({
            "sale_id": s.id,
            "total_amount": float(s.total_amount),
            "payment_method": s.payment_method.value,
            "is_credit": s.is_credit,
            "customer_name": customer_name,
            "created_at": s.created_at.isoformat(),
            "created_by_user_id": s.created_by_user_id,
            "items_count": len(items),
            "items": items,
        })

    return result


@router.get("/{sale_id}/receipt", response_class=HTMLResponse)
def get_receipt(
    sale_id: int,
    request: Request,
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

    business = db.query(Business).filter(Business.id == user.business_id).first()
    items = (
        db.query(SaleItem)
        .filter(SaleItem.sale_id == sale.id)
        .all()
    )

    customer_name = pii_decrypt(sale.customer_name_enc) if sale.customer_name_enc else None
    business_phone = pii_decrypt(business.phone_enc) if business.phone_enc else None

    cashier = db.query(User).filter(User.id == sale.created_by_user_id).first()
    cashier_email = pii_decrypt(cashier.email_enc) if cashier else f"User #{sale.created_by_user_id}"

    branch_name = None
    if sale.branch_id:
        from backend.app.models.entities import Branch
        branch = db.query(Branch).filter(Branch.id == sale.branch_id).first()
        branch_name = branch.name if branch else None

    logo_html = ""
    if business.logo_url:
        logo_html = f'<img src="{business.logo_url}" alt="logo" class="logo" />'

    items_html = ""
    for si in items:
        product = db.query(Product).filter(Product.id == si.product_id).first()
        product_name = product.name if product else f"Product #{si.product_id}"
        qty_display = si.display_quantity if si.display_quantity else si.quantity
        unit_display = si.display_unit if si.display_unit else "unit"
        items_html += f"<tr><td class='product'>{product_name}</td><td class='r'>{qty_display} {unit_display}</td><td class='r'>{float(si.unit_price):,.0f}</td><td class='r'>{float(si.line_total):,.0f}</td></tr>"

    voided_banner = ""
    if sale.is_voided:
        voided_banner = '<div class="voided">VOIDED</div>'

    due_line = f"Due: {sale.due_date}<br>" if sale.is_credit and sale.due_date else ""
    info_lines = f"Date: {sale.created_at.strftime('%Y-%m-%d %H:%M')}<br>Payment: {sale.payment_method.value.upper()}{' (CREDIT)' if sale.is_credit else ''}<br>{due_line}"
    if customer_name:
        info_lines += f"Customer: {customer_name}<br>"
    info_lines += f"Cashier: {cashier_email}<br>"
    if branch_name:
        info_lines += f"Branch: {branch_name}<br>"

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Receipt #{sale.id}</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box;font-family:'Arial','Helvetica',sans-serif}}
body{{max-width:360px;margin:0 auto;padding:20px;color:#000;background:#fff;font-size:13px;font-weight:700;line-height:1.4}}
.logo{{max-height:64px;max-width:180px;object-fit:contain;display:block;margin:0 auto 12px}}
.header{{text-align:center;margin-bottom:14px}}
.business-name{{font-size:20px;font-weight:900;letter-spacing:.5px}}
.business-phone{{font-size:13px;font-weight:800;color:#333;margin-top:4px}}
.divider{{border-top:2px dashed #000;margin:10px 0}}
.voided{{color:#dc2626;font-weight:900;text-align:center;font-size:18px;border:3px solid #dc2626;padding:6px;margin:10px 0;border-radius:4px}}
.info{{font-size:13px;font-weight:700;line-height:1.6;margin-bottom:10px}}
table{{width:100%;border-collapse:collapse;margin:10px 0}}
th{{border-bottom:3px solid #000;padding:6px 3px;font-size:12px;font-weight:900;text-align:left;text-transform:uppercase;letter-spacing:.4px}}
td{{padding:7px 3px;font-size:13px;font-weight:700;border-bottom:1px dashed #999;vertical-align:top}}
.product{{font-weight:900}}
.r{{text-align:right}}
.total{{border-top:3px solid #000;margin-top:12px;padding-top:12px;text-align:right;font-size:20px;font-weight:900}}
.footer{{text-align:center;margin-top:18px;font-size:12px;font-weight:700;color:#333;line-height:1.6}}
.print-btn{{display:block;width:100%;margin:0 0 16px;padding:12px;font-size:15px;cursor:pointer;background:#0a7e6b;color:#fff;border:none;border-radius:6px;font-weight:900}}
.print-btn:hover{{background:#096657}}
@media print{{.print-btn{{display:none}}body{{max-width:100%;padding:0;font-size:12px}}th,td{{font-weight:700}}}}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">Print Receipt</button>
<div class="header">
{logo_html}
<div class="business-name">{business.name}</div>
{f'<div class="business-phone">Tel: {business_phone}</div>' if business_phone else ''}
</div>
{voided_banner}
<div class="divider"></div>
<div class="info">{info_lines}</div>
<table>
<thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Total</th></tr></thead>
<tbody>{items_html}</tbody>
</table>
<div class="total">Total: RWF {float(sale.total_amount):,.0f}</div>
<div class="divider"></div>
<div class="footer">Thank you for your business!<br>Powered by EdeniSystem</div>
</body>
</html>"""


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
