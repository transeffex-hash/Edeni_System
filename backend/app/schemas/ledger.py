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

    class Config:
        from_attributes = True


class LedgerPartyBalance(BaseModel):
    party_name: str
    balance: float
