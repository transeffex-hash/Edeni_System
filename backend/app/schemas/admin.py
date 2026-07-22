from datetime import datetime

from pydantic import BaseModel


class BusinessOut(BaseModel):
    id: int
    name: str
    phone: str | None = None
    is_active: bool
    paid_amount_total: float
    created_at: datetime

    class Config:
        from_attributes = True
