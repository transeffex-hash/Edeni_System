from collections import defaultdict
from datetime import datetime, time

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user, require_boss
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


def _end_of_day(end_date: datetime | None) -> datetime | None:
    if end_date and end_date.time() == time.min:
        return end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
    return end_date


def _sale_query(db, business_id, start_date, end_date, branch_id=None):
    end_date = _end_of_day(end_date)
    q = db.query(Sale).filter(Sale.business_id == business_id, Sale.is_voided == False, Sale.status == "paid")  # noqa: E712
    if branch_id is not None:
        q = q.filter(Sale.branch_id == branch_id)
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
    user: User = Depends(get_current_user),
):
    sales = (
        _sale_query(db, user.business_id, start_date, end_date, user.branch_id)
        .order_by(Sale.created_at.asc())
        .all()
    )

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

    products: list[dict] = []
    sale_ids = [s.id for s in sales]
    if sale_ids:
        item_rows = (
            db.query(
                SaleItem.product_id,
                Product.name,
                func.sum(SaleItem.quantity).label("qty_sold"),
                func.sum(SaleItem.line_total).label("revenue"),
            )
            .join(Product, Product.id == SaleItem.product_id)
            .filter(SaleItem.sale_id.in_(sale_ids))
            .group_by(SaleItem.product_id, Product.name)
            .order_by(func.sum(SaleItem.line_total).desc())
            .all()
        )
        products = [
            {
                "product_id": r.product_id,
                "name": r.name,
                "qty_sold": int(r.qty_sold or 0),
                "revenue": float(r.revenue or 0),
            }
            for r in item_rows
        ]

    return {
        "rows": sorted(by_day.values(), key=lambda x: x["date"]),
        "products": products,
        "total": total,
        "count": len(sales),
    }


@router.get("/products")
def products_report(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    end_date = _end_of_day(end_date)
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
        .filter(Sale.is_voided == False)  # noqa: E712
        .filter(Sale.status == "paid")
    )
    if user.branch_id is not None:
        q = q.filter(Sale.branch_id == user.branch_id)
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


def _party_balance_report(
    *,
    db: Session,
    user: User,
    ledger_type: LedgerType,
    start_date: datetime | None,
    end_date: datetime | None,
    active_in_period: bool,
    include_settled: bool,
    limit: int,
) -> list[dict]:
    """Outstanding balance per party as of end_date.

    Balances are always cumulative up to end_date (a debt from last month is
    still a debt today). start_date only narrows *which* parties are listed
    when active_in_period is set, which keeps the report fast when there are
    many parties.
    """
    end_date = _end_of_day(end_date)
    limit = max(1, min(int(limit), 1000))

    rows_q = (
        db.query(
            LedgerEntry.party_name_hash,
            func.max(LedgerEntry.party_name_enc).label("party_name_enc"),
            func.sum(LedgerEntry.amount).label("balance"),
        )
        .filter(LedgerEntry.business_id == user.business_id)
        .filter(LedgerEntry.ledger_type == ledger_type)
    )
    if user.branch_id is not None:
        rows_q = rows_q.filter(LedgerEntry.branch_id == user.branch_id)
    if end_date:
        rows_q = rows_q.filter(LedgerEntry.created_at <= end_date)

    if active_in_period and start_date:
        active_q = (
            db.query(LedgerEntry.party_name_hash)
            .filter(LedgerEntry.business_id == user.business_id)
            .filter(LedgerEntry.ledger_type == ledger_type)
            .filter(LedgerEntry.created_at >= start_date)
        )
        if user.branch_id is not None:
            active_q = active_q.filter(LedgerEntry.branch_id == user.branch_id)
        if end_date:
            active_q = active_q.filter(LedgerEntry.created_at <= end_date)
        rows_q = rows_q.filter(LedgerEntry.party_name_hash.in_(active_q.distinct().subquery().select()))

    rows_q = rows_q.group_by(LedgerEntry.party_name_hash)
    if not include_settled:
        rows_q = rows_q.having(func.sum(LedgerEntry.amount) > 0)

    rows = rows_q.order_by(func.sum(LedgerEntry.amount).desc()).limit(limit).all()

    return [
        {"name": pii_decrypt(r.party_name_enc) or "", "balance": float(r.balance or 0)}
        for r in rows
    ]


@router.get("/customers")
def customers_report(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    active_in_period: bool = False,
    include_settled: bool = False,
    limit: int = 200,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return _party_balance_report(
        db=db,
        user=user,
        ledger_type=LedgerType.customer,
        start_date=start_date,
        end_date=end_date,
        active_in_period=active_in_period,
        include_settled=include_settled,
        limit=limit,
    )


@router.get("/suppliers")
def suppliers_report(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    active_in_period: bool = False,
    include_settled: bool = False,
    limit: int = 200,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return _party_balance_report(
        db=db,
        user=user,
        ledger_type=LedgerType.supplier,
        start_date=start_date,
        end_date=end_date,
        active_in_period=active_in_period,
        include_settled=include_settled,
        limit=limit,
    )


@router.get("/expiry")
def expiry_report(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    end_date = _end_of_day(end_date)
    from datetime import date, timedelta
    today = date.today()

    batches_q = (
        db.query(StockBatch, Product.name)
        .join(Product, Product.id == StockBatch.product_id)
        .filter(StockBatch.business_id == user.business_id)
        .filter(StockBatch.quantity > 0)
    )
    if user.branch_id is not None:
        batches_q = batches_q.filter(StockBatch.branch_id == user.branch_id)
    batches_q = batches_q.filter(StockBatch.expiry_date.isnot(None))
    if start_date:
        batches_q = batches_q.filter(StockBatch.expiry_date >= start_date.date())
    if end_date:
        batches_q = batches_q.filter(StockBatch.expiry_date <= end_date.date())
    batches = batches_q.order_by(StockBatch.expiry_date.asc()).all()

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
    end_date = _end_of_day(end_date)

    # Weighted average cost per product for legacy sales without stored cost_price
    avg_cost_q = (
        db.query(
            StockBatch.product_id,
            (func.sum(StockBatch.cost_price * StockBatch.quantity) / func.nullif(func.sum(StockBatch.quantity), 0)).label("avg_cost"),
        )
        .filter(StockBatch.business_id == user.business_id)
    )
    if user.branch_id is not None:
        avg_cost_q = avg_cost_q.filter(StockBatch.branch_id == user.branch_id)
    avg_costs = avg_cost_q.group_by(StockBatch.product_id).subquery()

    q = (
        db.query(
            SaleItem.product_id,
            Product.name,
            func.sum(SaleItem.line_total).label("revenue"),
            func.sum(SaleItem.quantity).label("qty_sold"),
            func.sum(SaleItem.quantity * func.coalesce(SaleItem.cost_price, avg_costs.c.avg_cost, 0)).label("cogs"),
        )
        .join(Product, Product.id == SaleItem.product_id)
        .join(Sale, Sale.id == SaleItem.sale_id)
        .outerjoin(avg_costs, avg_costs.c.product_id == SaleItem.product_id)
        .filter(SaleItem.business_id == user.business_id)
        .filter(Sale.is_voided == False)  # noqa: E712
        .filter(Sale.status == "paid")
    )
    if user.branch_id is not None:
        q = q.filter(Sale.branch_id == user.branch_id)
    if start_date:
        q = q.filter(Sale.created_at >= start_date)
    if end_date:
        q = q.filter(Sale.created_at <= end_date)

    rows = q.group_by(SaleItem.product_id, Product.name).all()

    result = []
    for r in rows:
        revenue = float(r.revenue or 0)
        cogs = float(r.cogs or 0)
        qty = int(r.qty_sold or 0)
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
    user: User = Depends(get_current_user),
):
    end_date = _end_of_day(end_date)
    # Cash inflows: cash/momo sales + customer payments (negative ledger entries)
    sales = _sale_query(db, user.business_id, start_date, end_date, branch_id=user.branch_id).order_by(Sale.created_at.asc()).all()

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
    if user.branch_id is not None:
        ledger_q = ledger_q.filter(LedgerEntry.branch_id == user.branch_id)
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


@router.get("/overdue")
def overdue_debts(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    end_date = _end_of_day(end_date)
    q = (
        db.query(Sale)
        .filter(
            Sale.business_id == user.business_id,
            Sale.is_voided == False,  # noqa: E712
            Sale.status == "paid",
            Sale.is_credit == True,  # noqa: E712
            Sale.due_date != None,  # noqa: E711
            Sale.due_date < func.current_date(),
        )
    )
    if user.branch_id is not None:
        q = q.filter(Sale.branch_id == user.branch_id)
    if start_date:
        q = q.filter(Sale.due_date >= start_date.date())
    if end_date:
        q = q.filter(Sale.due_date <= end_date.date())

    rows = q.order_by(Sale.due_date.asc()).all()
    today = datetime.utcnow().date()
    result = []
    for s in rows:
        due = s.due_date
        days_overdue = (today - due).days if due else 0
        result.append({
            "sale_id": s.id,
            "customer_name": pii_decrypt(s.customer_name_enc) or "—",
            "total_amount": float(s.total_amount),
            "due_date": due.isoformat() if due else None,
            "days_overdue": days_overdue,
        })
    return result


@router.get("/voided-sales")
def voided_sales_report(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_boss),
):
    end_date = _end_of_day(end_date)
    q = db.query(Sale).filter(
        Sale.business_id == user.business_id,
        Sale.is_voided == True,  # noqa: E712
    )
    if user.branch_id is not None:
        q = q.filter(Sale.branch_id == user.branch_id)
    if start_date:
        q = q.filter(Sale.voided_at >= start_date)
    if end_date:
        q = q.filter(Sale.voided_at <= end_date)

    rows = q.order_by(Sale.voided_at.desc()).all()
    result = []
    for s in rows:
        voided_by = db.query(User).filter(User.id == s.voided_by_user_id).first()
        result.append({
            "sale_id": s.id,
            "customer_name": pii_decrypt(s.customer_name_enc) or "—",
            "total_amount": float(s.total_amount),
            "payment_method": s.payment_method.value,
            "is_credit": s.is_credit,
            "voided_by_email": pii_decrypt(voided_by.email_enc) if voided_by else None,
            "voided_at": s.voided_at.isoformat() if s.voided_at else None,
            "void_reason": s.void_reason,
            "created_at": s.created_at.isoformat(),
        })
    return result
