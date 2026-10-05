from datetime import date, datetime

from pydantic import BaseModel


class BusinessOut(BaseModel):
    id: int
    name: str
    phone: str | None = None
    logo_url: str | None = None
    is_active: bool
    paid_amount_total: float
    subscription_end_date: date | None = None
    created_at: datetime
    user_count: int = 0
    product_count: int = 0
    branch_count: int = 0
    last_login_at: datetime | None = None

    class Config:
        from_attributes = True
