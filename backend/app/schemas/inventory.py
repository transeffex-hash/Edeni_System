from datetime import date, datetime

from pydantic import BaseModel


class ProductCreate(BaseModel):
    name: str
    sku: str | None = None
    unit: str = "unit"
    barcode: str | None = None
    selling_price: float | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    sku: str | None = None
    unit: str | None = None
    barcode: str | None = None


class ProductOut(BaseModel):
    id: int
    name: str
    sku: str | None
    unit: str
    barcode: str | None = None

    class Config:
        from_attributes = True


class ProductUnitCreate(BaseModel):
    name: str
    factor_to_base: int
    is_base: bool = False
    selling_price: float | None = None
    barcode: str | None = None


class ProductUnitUpdate(BaseModel):
    selling_price: float | None = None
    barcode: str | None = None


class ProductUnitOut(BaseModel):
    id: int
    product_id: int
    name: str
    factor_to_base: int
    is_base: bool
    selling_price: float | None
    barcode: str | None = None

    class Config:
        from_attributes = True


class StockBatchCreate(BaseModel):
    product_id: int
    quantity: float
    unit: str | None = None
    cost_price: float
    expiry_date: date | None = None
    branch_id: int | None = None
    is_credit_purchase: bool = False
    supplier_name: str | None = None
    amount_paid: float | None = None
    note: str | None = None


class StockBatchOut(BaseModel):
    id: int
    product_id: int
    branch_id: int | None = None
    quantity: int
    cost_price: float
    expiry_date: date | None
    created_at: datetime

    class Config:
        from_attributes = True


class StockBatchUpdate(BaseModel):
    quantity: float | None = None
    cost_price: float | None = None
    expiry_date: date | None = None


class ProductWithStock(BaseModel):
    id: int
    name: str
    sku: str | None
    unit: str
    barcode: str | None = None
    total_stock: int
    latest_cost_price: float | None
    nearest_expiry: date | None
    last_stock_date: datetime | None
    batch_count: int

    class Config:
        from_attributes = True


class BarcodeLookup(BaseModel):
    product: ProductWithStock
    unit: ProductUnitOut | None = None


class InventorySummary(BaseModel):
    total_products: int
    total_stock_value: float
    low_stock_items: int
    out_of_stock_items: int
