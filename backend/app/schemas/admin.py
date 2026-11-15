from datetime import date, datetime

from pydantic import BaseModel


class BusinessOut(BaseModel):
    id: int
    name: str
    phone: str | None = None
    logo_url: str | None = None
    is_active: bool
    paid_amount_total: float
    subscription_start_date: date | None = None
    subscription_end_date: date | None = None
    created_at: datetime
    user_count: int = 0
    product_count: int = 0
    branch_count: int = 0
    last_login_at: datetime | None = None

    class Config:
        from_attributes = True


class SubscriptionSet(BaseModel):
    start_date: date
    end_date: date
    amount: float = 0
    note: str | None = None


class SubscriptionPaymentOut(BaseModel):
    id: int
    start_date: date
    end_date: date
    amount: float
    note: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True
