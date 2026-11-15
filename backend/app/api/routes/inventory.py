from datetime import datetime, time
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, case, func, or_
from sqlalchemy.orm import Session, aliased

from backend.app.api.deps import get_current_user
from backend.app.core.audit import log_audit
from backend.app.core.db import get_db
from backend.app.core.pii_crypto import pii_encrypt, pii_hash
from backend.app.models.entities import (
    Branch,
    LedgerEntry,
    LedgerType,
    Product,
    ProductUnit,
    StockBatch,
    User,
    UserRole,
)
from backend.app.schemas.inventory import (
    BarcodeLookup,
    InventorySummary,
    ProductCreate,
    ProductOut,
    ProductUnitCreate,
    ProductUnitOut,
    ProductUnitUpdate,
    ProductUpdate,
    ProductWithStock,
    StockBatchCreate,
    StockBatchOut,
    StockBatchUpdate,
)

router = APIRouter()


def _clean_barcode(raw: str | None) -> str | None:
    code = (raw or "").strip()
    return code or None


def _barcode_in_use(
    db: Session,
    business_id: int,
    code: str,
    *,
    exclude_product_id: int | None = None,
    exclude_unit_id: int | None = None,
) -> bool:
    pq = db.query(Product.id).filter(Product.business_id == business_id, Product.barcode == code)
    if exclude_product_id is not None:
        pq = pq.filter(Product.id != exclude_product_id)
    if pq.first():
        return True
    uq = db.query(ProductUnit.id).filter(ProductUnit.business_id == business_id, ProductUnit.barcode == code)
    if exclude_unit_id is not None:
        uq = uq.filter(ProductUnit.id != exclude_unit_id)
    return uq.first() is not None


def _product_with_stock(db: Session, user: User, product: Product) -> ProductWithStock:
    stock_filter = [StockBatch.business_id == user.business_id, StockBatch.product_id == product.id]
    if user.branch_id is not None:
        stock_filter.append(or_(StockBatch.branch_id == user.branch_id, StockBatch.branch_id.is_(None)))
    agg = (
        db.query(
            func.coalesce(func.sum(StockBatch.quantity), 0),
            func.min(StockBatch.expiry_date),
            func.max(StockBatch.created_at),
            func.count(StockBatch.id),
        )
        .filter(*stock_filter)
        .one()
    )
    latest = db.query(StockBatch.cost_price).filter(*stock_filter).order_by(StockBatch.id.desc()).first()
    return ProductWithStock(
        id=product.id,
        name=product.name,
        sku=product.sku,
        unit=product.unit,
        barcode=product.barcode,
        total_stock=int(agg[0] or 0),
        latest_cost_price=float(latest[0]) if latest and latest[0] is not None else None,
        nearest_expiry=agg[1],
        last_stock_date=agg[2],
        batch_count=int(agg[3] or 0),
    )


@router.post("/products", response_model=ProductOut)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    name = payload.name.strip()
    unit = payload.unit.strip() or "unit"
    sku = payload.sku.strip() if payload.sku else None
    barcode = _clean_barcode(payload.barcode)
    if not name:
        raise HTTPException(status_code=400, detail="Product name is required")
    duplicate_query = db.query(Product).filter(Product.business_id == user.business_id, Product.name == name)
    if sku:
        duplicate_query = duplicate_query.filter(Product.sku == sku)
    elif duplicate_query.first():
        raise HTTPException(status_code=409, detail="Product already exists")
    if sku and duplicate_query.first():
        raise HTTPException(status_code=409, detail="Product SKU already exists")
    if barcode and _barcode_in_use(db, user.business_id, barcode):
        raise HTTPException(status_code=409, detail="This barcode is already assigned to another product")

    product = Product(
        business_id=user.business_id,
        name=name,
        sku=sku,
        unit=unit,
        barcode=barcode,
    )
    db.add(product)
    db.flush()

    # A default selling price makes scanning at the till instant (no price typing).
    if payload.selling_price is not None:
        db.add(
            ProductUnit(
                business_id=user.business_id,
                product_id=product.id,
                name=unit,
                factor_to_base=1,
                is_base=True,
                selling_price=payload.selling_price,
            )
        )

    log_audit(
        db=db,
        business_id=user.business_id,
        user_id=user.id,
        action="create_product",
        resource="Product",
        resource_id=product.id,
        details={"name": product.name, "sku": product.sku, "barcode": product.barcode},
    )
    db.commit()
    db.refresh(product)
    return product


@router.patch("/products/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    product = (
        db.query(Product)
        .filter(Product.business_id == user.business_id, Product.id == product_id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Product name is required")
        product.name = name
    if payload.sku is not None:
        product.sku = payload.sku.strip() or None
    if payload.unit is not None and payload.unit.strip():
        product.unit = payload.unit.strip()
    if payload.barcode is not None:
        code = _clean_barcode(payload.barcode)
        if code and _barcode_in_use(db, user.business_id, code, exclude_product_id=product.id):
            raise HTTPException(status_code=409, detail="This barcode is already assigned to another product")
        product.barcode = code

    log_audit(
        db=db,
        business_id=user.business_id,
        user_id=user.id,
        action="update_product",
        resource="Product",
        resource_id=product.id,
        details={"name": product.name, "sku": product.sku, "barcode": product.barcode},
    )
    db.commit()
    db.refresh(product)
    return product


@router.get("/products/by-barcode/{code}", response_model=BarcodeLookup)
def lookup_barcode(
    code: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Resolve a scanned barcode to a product (and the specific unit, if the
    barcode belongs to a unit such as a carton)."""
    code = code.strip()
    if not code:
        raise HTTPException(status_code=400, detail="Empty barcode")

    unit_row = (
        db.query(ProductUnit)
        .filter(ProductUnit.business_id == user.business_id, ProductUnit.barcode == code)
        .first()
    )
    if unit_row:
        product = db.query(Product).filter(Product.id == unit_row.product_id).first()
        return BarcodeLookup(product=_product_with_stock(db, user, product), unit=unit_row)

    product = (
        db.query(Product)
        .filter(Product.business_id == user.business_id, Product.barcode == code)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="No product with this barcode")
    base_unit = (
        db.query(ProductUnit)
        .filter(ProductUnit.business_id == user.business_id, ProductUnit.product_id == product.id)
        .order_by(ProductUnit.is_base.desc(), ProductUnit.id.asc())
        .first()
    )
    return BarcodeLookup(product=_product_with_stock(db, user, product), unit=base_unit)


@router.get("/products/{product_id}/units", response_model=list[ProductUnitOut])
def list_product_units(
    product_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return (
        db.query(ProductUnit)
        .filter(ProductUnit.business_id == user.business_id)
        .filter(ProductUnit.product_id == product_id)
        .order_by(ProductUnit.is_base.desc(), ProductUnit.id.asc())
        .all()
    )


@router.post("/products/{product_id}/units", response_model=ProductUnitOut)
def create_product_unit(
    product_id: int,
    payload: ProductUnitCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    product = (
        db.query(Product)
        .filter(Product.business_id == user.business_id)
        .filter(Product.id == product_id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    unit_name = payload.name.strip()
    if not unit_name:
        raise HTTPException(status_code=400, detail="Unit name is required")
    if payload.factor_to_base <= 0:
        raise HTTPException(status_code=400, detail="factor_to_base must be > 0")
    existing_unit = (
        db.query(ProductUnit)
        .filter(ProductUnit.business_id == user.business_id)
        .filter(ProductUnit.product_id == product_id)
        .filter(ProductUnit.name == unit_name)
        .first()
    )
    if existing_unit:
        raise HTTPException(status_code=409, detail="Product unit already exists")

    barcode = _clean_barcode(payload.barcode)
    if barcode and _barcode_in_use(db, user.business_id, barcode):
        raise HTTPException(status_code=409, detail="This barcode is already assigned to another product")

    if payload.is_base:
        # Enforce single base unit per product
        (
            db.query(ProductUnit)
            .filter(ProductUnit.business_id == user.business_id)
            .filter(ProductUnit.product_id == product_id)
            .update({ProductUnit.is_base: False})
        )

    row = ProductUnit(
        business_id=user.business_id,
        product_id=product_id,
        name=unit_name,
        factor_to_base=payload.factor_to_base,
        is_base=payload.is_base,
        selling_price=payload.selling_price,
        barcode=barcode,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/products/{product_id}/units/{unit_id}", response_model=ProductUnitOut)
def update_product_unit(
    product_id: int,
    unit_id: int,
    payload: ProductUnitUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = (
        db.query(ProductUnit)
        .filter(ProductUnit.business_id == user.business_id)
        .filter(ProductUnit.product_id == product_id, ProductUnit.id == unit_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Product unit not found")
    if payload.selling_price is not None:
        row.selling_price = payload.selling_price
    if payload.barcode is not None:
        code = _clean_barcode(payload.barcode)
        if code and _barcode_in_use(db, user.business_id, code, exclude_unit_id=row.id):
            raise HTTPException(status_code=409, detail="This barcode is already assigned to another product")
        row.barcode = code
    db.commit()
    db.refresh(row)
    return row


@router.get("/products", response_model=list[ProductOut])
def list_products(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    limit = max(1, min(int(limit), 50))
    offset = max(0, int(offset))
    return (
        db.query(Product)
        .filter(Product.business_id == user.business_id)
        .order_by(Product.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/products/with-stock", response_model=list[ProductWithStock])
def list_products_with_stock(
    search: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    limit = max(1, min(int(limit), 200))
    offset = max(0, int(offset))

    StockBatchLatest = aliased(StockBatch)

    base_stock_filter = [StockBatch.business_id == user.business_id]
    latest_stock_filter = [StockBatchLatest.business_id == user.business_id]
    if user.branch_id is not None:
        base_stock_filter.append(
            or_(
                StockBatch.branch_id == user.branch_id,
                StockBatch.branch_id.is_(None),
            )
        )
        latest_stock_filter.append(
            or_(
                StockBatchLatest.branch_id == user.branch_id,
                StockBatchLatest.branch_id.is_(None),
            )
        )

    latest_ids = (
        db.query(
            StockBatch.product_id,
            func.max(StockBatch.id).label("latest_id"),
        )
        .filter(*base_stock_filter)
        .group_by(StockBatch.product_id)
        .subquery()
    )

    latest_batches = (
        db.query(
            latest_ids.c.product_id,
            StockBatch.cost_price.label("latest_cost_price"),
        )
        .join(
            StockBatch,
            and_(
                StockBatch.product_id == latest_ids.c.product_id,
                StockBatch.id == latest_ids.c.latest_id,
            ),
        )
        .subquery()
    )

    query = (
        db.query(
            Product.id,
            Product.name,
            Product.sku,
            Product.unit,
            Product.barcode,
            func.coalesce(func.sum(StockBatch.quantity), 0).label("total_stock"),
            latest_batches.c.latest_cost_price,
            func.min(StockBatch.expiry_date).label("nearest_expiry"),
            func.max(StockBatch.created_at).label("last_stock_date"),
            func.count(StockBatch.id).label("batch_count"),
        )
        .outerjoin(
            StockBatch,
            and_(
                StockBatch.product_id == Product.id,
                *base_stock_filter,
            ),
        )
        .outerjoin(latest_batches, latest_batches.c.product_id == Product.id)
        .filter(Product.business_id == user.business_id)
        .group_by(
            Product.id,
            Product.name,
            Product.sku,
            Product.unit,
            Product.barcode,
            latest_batches.c.latest_cost_price,
        )
    )

    if search:
        s = search.strip()
        query = query.filter(
            or_(Product.name.ilike(f"%{s}%"), Product.sku.ilike(f"%{s}%"), Product.barcode == s)
        )

    if date_from:
        try:
            from datetime import datetime as dt
            df = dt.strptime(date_from, "%Y-%m-%d")
            query = query.filter(StockBatch.created_at >= df)
        except ValueError:
            pass

    if date_to:
        try:
            from datetime import datetime as dt, timedelta
            dt_val = dt.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(StockBatch.created_at < dt_val)
        except ValueError:
            pass

    rows = (
        query
        .order_by(Product.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [
        ProductWithStock(
            id=r.id,
            name=r.name,
            sku=r.sku,
            unit=r.unit,
            barcode=r.barcode,
            total_stock=int(r.total_stock or 0),
            latest_cost_price=float(r.latest_cost_price) if r.latest_cost_price else None,
            nearest_expiry=r.nearest_expiry if r.nearest_expiry else None,
            last_stock_date=r.last_stock_date if r.last_stock_date else None,
            batch_count=int(r.batch_count or 0),
        )
        for r in rows
    ]


@router.get("/summary", response_model=InventorySummary)
def inventory_summary(
    branch_id: int | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999) if end_date and end_date.time() == time.min else end_date
    requested_branch_id = user.branch_id if user.branch_id is not None else branch_id

    base_stock_filter = [StockBatch.business_id == user.business_id]
    if requested_branch_id is not None:
        base_stock_filter.append(StockBatch.branch_id == requested_branch_id)
    if start_date:
        base_stock_filter.append(StockBatch.created_at >= start_date)
    if end_date:
        base_stock_filter.append(StockBatch.created_at <= end_date)

    stock_by_product = (
        db.query(
            Product.id,
            func.coalesce(func.sum(StockBatch.quantity), 0).label("total_stock"),
            func.coalesce(func.sum(StockBatch.quantity * StockBatch.cost_price), 0).label("stock_value"),
        )
        .outerjoin(
            StockBatch,
            and_(
                StockBatch.product_id == Product.id,
                *base_stock_filter,
            ),
        )
        .filter(Product.business_id == user.business_id)
        .group_by(Product.id)
        .subquery()
    )

    totals = (
        db.query(
            func.count(stock_by_product.c.id).label("total_products"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            and_(
                                stock_by_product.c.total_stock > 0,
                                stock_by_product.c.total_stock <= 5,
                            ),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("low_stock_items"),
            func.coalesce(
                func.sum(
                    case((stock_by_product.c.total_stock == 0, 1), else_=0)
                ),
                0,
            ).label("out_of_stock_items"),
            func.coalesce(func.sum(stock_by_product.c.stock_value), 0).label("total_stock_value"),
        )
        .select_from(stock_by_product)
        .one()
    )

    return InventorySummary(
        total_products=totals.total_products or 0,
        total_stock_value=float(totals.total_stock_value),
        low_stock_items=totals.low_stock_items or 0,
        out_of_stock_items=totals.out_of_stock_items or 0,
    )


@router.post("/stock", response_model=StockBatchOut)
def add_stock(
    payload: StockBatchCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        qty = Decimal(str(payload.quantity))
    except InvalidOperation as e:
        raise HTTPException(status_code=400, detail="Invalid quantity") from e

    if qty <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be > 0")

    unit_name = (payload.unit or "").strip() or None

    # Resolve unit factor (defaults to product.unit if no units are configured)
    factor = None
    if unit_name:
        u = (
            db.query(ProductUnit)
            .filter(ProductUnit.business_id == user.business_id)
            .filter(ProductUnit.product_id == payload.product_id)
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
            .filter(ProductUnit.product_id == payload.product_id)
            .filter(ProductUnit.is_base == True)  # noqa: E712
            .first()
        )
        factor = Decimal(base.factor_to_base) if base else Decimal(1)

    base_qty = qty * factor
    if base_qty != base_qty.to_integral_value():
        raise HTTPException(status_code=400, detail="Quantity results in fractional base units")

    target_branch_id = user.branch_id
    if user.branch_id is None:
        if payload.branch_id is not None:
            branch = (
                db.query(Branch)
                .filter(Branch.business_id == user.business_id)
                .filter(Branch.id == payload.branch_id)
                .first()
            )
            if not branch:
                raise HTTPException(status_code=404, detail="Branch not found")
            target_branch_id = branch.id
        else:
            # single-branch fallback: assign to the only active branch
            only_branch = (
                db.query(Branch)
                .filter(Branch.business_id == user.business_id)
                .first()
            )
            if only_branch:
                target_branch_id = only_branch.id

    batch = StockBatch(
        business_id=user.business_id,
        product_id=payload.product_id,
        branch_id=target_branch_id,
        quantity=int(base_qty),
        cost_price=payload.cost_price,
        expiry_date=payload.expiry_date,
    )
    db.add(batch)
    db.flush()

    supplier_name = (payload.supplier_name or "").strip()
    if payload.is_credit_purchase:
        if not supplier_name:
            raise HTTPException(status_code=400, detail="Supplier name is required for credit purchases")

        purchase_total = Decimal(str(payload.cost_price)) * base_qty
        paid = Decimal(str(payload.amount_paid)) if payload.amount_paid else Decimal(0)
        if paid < 0:
            raise HTTPException(status_code=400, detail="Amount paid cannot be negative")
        if paid > purchase_total:
            raise HTTPException(status_code=400, detail="Amount paid cannot exceed purchase total")

        product = (
            db.query(Product)
            .filter(Product.business_id == user.business_id)
            .filter(Product.id == payload.product_id)
            .first()
        )
        product_label = product.name if product else f"product #{payload.product_id}"

        db.add(
            LedgerEntry(
                business_id=user.business_id,
                branch_id=target_branch_id,
                ledger_type=LedgerType.supplier,
                party_name_enc=pii_encrypt(supplier_name) or "",
                party_name_hash=pii_hash(supplier_name),
                amount=purchase_total,
                note=payload.note or f"Stock purchase on credit: {product_label} x {int(base_qty)}",
            )
        )
        if paid > 0:
            db.add(
                LedgerEntry(
                    business_id=user.business_id,
                    branch_id=target_branch_id,
                    ledger_type=LedgerType.supplier,
                    party_name_enc=pii_encrypt(supplier_name) or "",
                    party_name_hash=pii_hash(supplier_name),
                    amount=-paid,
                    note=f"Payment on stock purchase: {product_label}",
                )
            )

    log_audit(
        db=db,
        business_id=user.business_id,
        user_id=user.id,
        action="add_stock",
        resource="StockBatch",
        resource_id=batch.id,
        details={
            "product_id": payload.product_id,
            "quantity": int(base_qty),
            "cost_price": float(payload.cost_price),
            "is_credit_purchase": payload.is_credit_purchase,
            "supplier_name": supplier_name or None,
        },
    )
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/products/{product_id}/stock", response_model=list[StockBatchOut])
def list_stock_batches(
    product_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return (
        db.query(StockBatch)
        .filter(StockBatch.business_id == user.business_id)
        .filter(StockBatch.product_id == product_id)
        .order_by(StockBatch.id.desc())
        .all()
    )


@router.patch("/stock/{batch_id}", response_model=StockBatchOut)
def update_stock_batch(
    batch_id: int,
    payload: StockBatchUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != UserRole.boss:
        raise HTTPException(status_code=403, detail="Only boss can edit stock")

    batch = (
        db.query(StockBatch)
        .filter(StockBatch.business_id == user.business_id)
        .filter(StockBatch.id == batch_id)
        .first()
    )
    if not batch:
        raise HTTPException(status_code=404, detail="Stock batch not found")

    if payload.quantity is not None:
        try:
            qty = Decimal(str(payload.quantity))
        except InvalidOperation as e:
            raise HTTPException(status_code=400, detail="Invalid quantity") from e
        if qty <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be > 0")
        batch.quantity = int(qty)

    if payload.cost_price is not None:
        batch.cost_price = payload.cost_price

    if payload.expiry_date is not None:
        batch.expiry_date = payload.expiry_date

    log_audit(
        db=db,
        business_id=user.business_id,
        user_id=user.id,
        action="edit_stock",
        resource="StockBatch",
        resource_id=batch.id,
        details={"quantity": batch.quantity, "cost_price": float(batch.cost_price)},
    )
    db.commit()
    db.refresh(batch)
    return batch


@router.delete("/stock/{batch_id}")
def delete_stock_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != UserRole.boss:
        raise HTTPException(status_code=403, detail="Only boss can delete stock")

    batch = (
        db.query(StockBatch)
        .filter(StockBatch.business_id == user.business_id)
        .filter(StockBatch.id == batch_id)
        .first()
    )
    if not batch:
        raise HTTPException(status_code=404, detail="Stock batch not found")

    log_audit(
        db=db,
        business_id=user.business_id,
        user_id=user.id,
        action="delete_stock",
        resource="StockBatch",
        resource_id=batch.id,
        details={"product_id": batch.product_id, "quantity": batch.quantity},
    )
    db.delete(batch)
    db.commit()
    return {"ok": True}
