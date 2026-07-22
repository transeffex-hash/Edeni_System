from datetime import date

from pydantic import BaseModel


class ProductCreate(BaseModel):
    name: str
    sku: str | None = None
    unit: str = "unit"


class ProductOut(BaseModel):
    id: int
    name: str
    sku: str | None
    unit: str

    class Config:
        from_attributes = True


class ProductUnitCreate(BaseModel):
    name: str
    factor_to_base: int
    is_base: bool = False


class ProductUnitOut(BaseModel):
    id: int
    product_id: int
    name: str
    factor_to_base: int
    is_base: bool

    class Config:
        from_attributes = True


class StockBatchCreate(BaseModel):
    product_id: int
    quantity: float
    unit: str | None = None
    cost_price: float
    expiry_date: date | None = None


class StockBatchOut(BaseModel):
    id: int
    product_id: int
    quantity: int
    cost_price: float
    expiry_date: date | None

    class Config:
        from_attributes = True
