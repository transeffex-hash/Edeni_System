from datetime import date

from pydantic import BaseModel

from backend.app.models.entities import PaymentMethod


class SaleItemCreate(BaseModel):
    product_id: int
    quantity: float
    unit: str | None = None
    unit_price: float | None = None


class SaleCreate(BaseModel):
    payment_method: PaymentMethod
    is_credit: bool = False
    customer_name: str | None = None
    customer_id: int | None = None
    due_date: date | None = None
    items: list[SaleItemCreate]


class SaleShareRequest(BaseModel):
    phone: str | None = None


class DraftUpsert(BaseModel):
    id: int | None = None
    customer_name: str | None = None
    items: list[SaleItemCreate] = []


class SaleItemUpdate(BaseModel):
    unit_price: float | None = None


class SalePaymentCreate(BaseModel):
    method: PaymentMethod
    amount: float
    note: str | None = None
