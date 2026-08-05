from datetime import datetime

from pydantic import BaseModel

from backend.app.models.entities import LedgerType


class LedgerEntryCreate(BaseModel):
    ledger_type: LedgerType
    party_name: str
    amount: float
    note: str | None = None


class LedgerEntryOut(BaseModel):
    id: int
    ledger_type: LedgerType
    party_name: str
    amount: float
    note: str | None
    created_at: datetime
    running_balance: float = 0.0

    class Config:
        from_attributes = True


class LedgerPartyBalance(BaseModel):
    party_name: str
    balance: float


class LedgerStatementOut(BaseModel):
    opening_balance: float
    total_credit_sales: float
    total_payments: float
    closing_balance: float
    outstanding_balance: float
    entries: list[LedgerEntryOut]
