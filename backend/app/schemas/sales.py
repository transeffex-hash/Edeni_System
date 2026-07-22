from pydantic import BaseModel

from backend.app.models.entities import PaymentMethod


class SaleItemCreate(BaseModel):
    product_id: int
    quantity: float
    unit: str | None = None
    unit_price: float


class SaleCreate(BaseModel):
    payment_method: PaymentMethod
    is_credit: bool = False
    customer_name: str | None = None
    items: list[SaleItemCreate]
