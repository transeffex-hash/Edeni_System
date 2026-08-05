from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.app.api.deps import require_boss
from backend.app.core.db import get_db
from backend.app.core.pii_crypto import pii_decrypt
from backend.app.models.entities import (
    LedgerEntry,
    LedgerType,
    Product,
    Sale,
    SaleItem,
    StockBatch,
    User,
)

router = APIRouter()


def _sale_query(db, business_id, start_date, end_date):
    q = db.query(Sale).filter(Sale.business_id == business_id)
    if start_date:
        q = q.filter(Sale.created_at >= start_date)
    if end_date:
        q = q.filter(Sale.created_at <= end_date)
    return q


@router.get("/sales")
def sales_report(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_boss),
):
    sales = _sale_query(db, user.business_id, start_date, end_date).order_by(Sale.created_at.asc()).all()

    by_day: dict = defaultdict(lambda: {"date": "", "cash": 0.0, "momo": 0.0, "credit": 0.0, "total": 0.0, "count": 0})
    for s in sales:
        day = s.created_at.date().isoformat()
        by_day[day]["date"] = day
        by_day[day]["count"] += 1
        amt = float(s.total_amount)
        by_day[day]["total"] += amt
        if s.is_credit:
            by_day[day]["credit"] += amt
        elif s.payment_method.value == "momo":
            by_day[day]["momo"] += amt
        else:
            by_day[day]["cash"] += amt

    total = sum(float(s.total_amount) for s in sales)
    return {
        "rows": sorted(by_day.values(), key=lambda x: x["date"]),
        "total": total,
        "count": len(sales),
    }


@router.get("/products")
def products_report(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_boss),
):
    q = (
        db.query(
            SaleItem.product_id,
            Product.name,
            func.sum(SaleItem.quantity).label("qty_sold"),
            func.sum(SaleItem.line_total).label("revenue"),
            func.count(SaleItem.id).label("tx_count"),
        )
        .join(Product, Product.id == SaleItem.product_id)
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(SaleItem.business_id == user.business_id)
    )
    if start_date:
        q = q.filter(Sale.created_at >= start_date)
    if end_date:
        q = q.filter(Sale.created_at <= end_date)

    rows = q.group_by(SaleItem.product_id, Product.name).order_by(func.sum(SaleItem.line_total).desc()).all()

    return [
        {
            "product_id": r.product_id,
            "name": r.name,
            "qty_sold": int(r.qty_sold or 0),
            "revenue": float(r.revenue or 0),
            "tx_count": int(r.tx_count or 0),
        }
        for r in rows
    ]


@router.get("/customers")
def customers_report(
    db: Session = Depends(get_db),
    user: User = Depends(require_boss),
):
    rows = (
        db.query(LedgerEntry.party_name_hash, LedgerEntry.party_name_enc, func.sum(LedgerEntry.amount).label("balance"))
        .filter(LedgerEntry.business_id == user.business_id)
        .filter(LedgerEntry.ledger_type == LedgerType.customer)
        .group_by(LedgerEntry.party_name_hash, LedgerEntry.party_name_enc)
        .order_by(func.sum(LedgerEntry.amount).desc())
        .all()
    )

    # Deduplicate by hash (take highest balance sample for name)
    seen: dict = {}
    for r in rows:
        h = r.party_name_hash
        bal = float(r.balance or 0)
        if h not in seen or bal > seen[h]["balance"]:
            seen[h] = {"name": pii_decrypt(r.party_name_enc) or "", "balance": bal}

    return sorted(seen.values(), key=lambda x: x["balance"], reverse=True)


@router.get("/suppliers")
def suppliers_report(
    db: Session = Depends(get_db),
    user: User = Depends(require_boss),
):
    rows = (
        db.query(LedgerEntry.party_name_hash, LedgerEntry.party_name_enc, func.sum(LedgerEntry.amount).label("balance"))
        .filter(LedgerEntry.business_id == user.business_id)
        .filter(LedgerEntry.ledger_type == LedgerType.supplier)
        .group_by(LedgerEntry.party_name_hash, LedgerEntry.party_name_enc)
        .order_by(func.sum(LedgerEntry.amount).desc())
        .all()
    )

    seen: dict = {}
    for r in rows:
        h = r.party_name_hash
        bal = float(r.balance or 0)
        if h not in seen or bal > seen[h]["balance"]:
            seen[h] = {"name": pii_decrypt(r.party_name_enc) or "", "balance": bal}

    return sorted(seen.values(), key=lambda x: x["balance"], reverse=True)


@router.get("/expiry")
def expiry_report(
    db: Session = Depends(get_db),
    user: User = Depends(require_boss),
):
    from datetime import date, timedelta
    today = date.today()

    batches = (
        db.query(StockBatch, Product.name)
        .join(Product, Product.id == StockBatch.product_id)
        .filter(StockBatch.business_id == user.business_id)
        .filter(StockBatch.quantity > 0)
        .filter(StockBatch.expiry_date.isnot(None))
        .order_by(StockBatch.expiry_date.asc())
        .all()
    )

    def urgency(exp_date):
        days = (exp_date - today).days
        if days < 0:
            return "expired"
        if days <= 7:
            return "critical"
        if days <= 14:
            return "warning"
        return "ok"

    return [
        {
            "batch_id": b.id,
            "product_name": name,
            "quantity": b.quantity,
            "expiry_date": b.expiry_date.isoformat(),
            "days_left": (b.expiry_date - today).days,
            "urgency": urgency(b.expiry_date),
        }
        for b, name in batches
    ]


@router.get("/profit")
def profit_report(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_boss),
):
    # Revenue per product from sales in the period
    q = (
        db.query(
            SaleItem.product_id,
            Product.name,
            func.sum(SaleItem.line_total).label("revenue"),
            func.sum(SaleItem.quantity).label("qty_sold"),
        )
        .join(Product, Product.id == SaleItem.product_id)
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(SaleItem.business_id == user.business_id)
    )
    if start_date:
        q = q.filter(Sale.created_at >= start_date)
    if end_date:
        q = q.filter(Sale.created_at <= end_date)

    revenue_rows = q.group_by(SaleItem.product_id, Product.name).all()

    # Average cost per product from all stock batches (weighted by quantity received)
    cost_rows = (
        db.query(
            StockBatch.product_id,
            func.sum(StockBatch.cost_price * StockBatch.quantity).label("total_cost"),
            func.sum(StockBatch.quantity).label("total_qty"),
        )
        .filter(StockBatch.business_id == user.business_id)
        .group_by(StockBatch.product_id)
        .all()
    )
    avg_cost = {r.product_id: float(r.total_cost or 0) / max(int(r.total_qty or 1), 1) for r in cost_rows}

    result = []
    for r in revenue_rows:
        revenue = float(r.revenue or 0)
        qty = int(r.qty_sold or 0)
        cogs = avg_cost.get(r.product_id, 0) * qty
        result.append({
            "product_id": r.product_id,
            "name": r.name,
            "revenue": revenue,
            "cogs": round(cogs, 2),
            "profit": round(revenue - cogs, 2),
            "qty_sold": qty,
        })

    result.sort(key=lambda x: x["profit"], reverse=True)
    return result


@router.get("/cashflow")
def cashflow_report(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_boss),
):
    # Cash inflows: cash/momo sales + customer payments (negative ledger entries)
    sales = _sale_query(db, user.business_id, start_date, end_date).order_by(Sale.created_at.asc()).all()

    by_day: dict = defaultdict(lambda: {
        "date": "", "cash_sales": 0.0, "momo_sales": 0.0,
        "credit_sales": 0.0, "payments_received": 0.0, "net": 0.0
    })

    for s in sales:
        day = s.created_at.date().isoformat()
        by_day[day]["date"] = day
        amt = float(s.total_amount)
        if s.is_credit:
            by_day[day]["credit_sales"] += amt
        elif s.payment_method.value == "momo":
            by_day[day]["momo_sales"] += amt
            by_day[day]["net"] += amt
        else:
            by_day[day]["cash_sales"] += amt
            by_day[day]["net"] += amt

    # Customer payments from ledger (negative amount = payment received)
    ledger_q = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.business_id == user.business_id)
        .filter(LedgerEntry.ledger_type == LedgerType.customer)
        .filter(LedgerEntry.amount < 0)
    )
    if start_date:
        ledger_q = ledger_q.filter(LedgerEntry.created_at >= start_date)
    if end_date:
        ledger_q = ledger_q.filter(LedgerEntry.created_at <= end_date)

    for e in ledger_q.all():
        day = e.created_at.date().isoformat()
        by_day[day]["date"] = day
        by_day[day]["payments_received"] += abs(float(e.amount))
        by_day[day]["net"] += abs(float(e.amount))

    return sorted(by_day.values(), key=lambda x: x["date"])
