from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user
from backend.app.core.db import get_db
from backend.app.models.entities import Product, ProductUnit, StockBatch, User
from backend.app.schemas.inventory import (
    ProductCreate,
    ProductOut,
    ProductUnitCreate,
    ProductUnitOut,
    StockBatchCreate,
    StockBatchOut,
)

router = APIRouter()


@router.post("/products", response_model=ProductOut)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    product = Product(
        business_id=user.business_id,
        name=payload.name,
        sku=payload.sku,
        unit=payload.unit,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


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

    if payload.factor_to_base <= 0:
        raise HTTPException(status_code=400, detail="factor_to_base must be > 0")

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
        name=payload.name.strip(),
        factor_to_base=payload.factor_to_base,
        is_base=payload.is_base,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/products", response_model=list[ProductOut])
def list_products(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    limit = max(1, min(int(limit), 200))
    offset = max(0, int(offset))
    return (
        db.query(Product)
        .filter(Product.business_id == user.business_id)
        .order_by(Product.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
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

    batch = StockBatch(
        business_id=user.business_id,
        product_id=payload.product_id,
        quantity=int(base_qty),
        cost_price=payload.cost_price,
        expiry_date=payload.expiry_date,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch
