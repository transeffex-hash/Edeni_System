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

    class Config:
        from_attributes = True
