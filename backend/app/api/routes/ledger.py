from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user
from backend.app.core.db import get_db
from backend.app.core.pii_crypto import pii_decrypt, pii_encrypt, pii_hash
from backend.app.models.entities import LedgerEntry, LedgerType, User
from backend.app.schemas.ledger import LedgerEntryCreate, LedgerEntryOut, LedgerPartyBalance

router = APIRouter()


@router.post("/entries", response_model=LedgerEntryOut)
def create_entry(
    payload: LedgerEntryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Continuous ledger approach:
    # - Positive `amount` means the party owes the business (customer credit) or business owes the party (supplier credit).
    # - Negative `amount` means a payment was made to reduce the balance.
    # This avoids closing cycles and stays simple for local users.

    entry = LedgerEntry(
        business_id=user.business_id,
        ledger_type=payload.ledger_type,
        party_name_enc=pii_encrypt(payload.party_name) or "",
        party_name_hash=pii_hash(payload.party_name),
        amount=payload.amount,
        note=payload.note,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return LedgerEntryOut(
        id=entry.id,
        ledger_type=entry.ledger_type,
        party_name=pii_decrypt(entry.party_name_enc) or "",
        amount=float(entry.amount),
        note=entry.note,
    )


@router.get("/entries", response_model=list[LedgerEntryOut])
def list_entries(
    ledger_type: LedgerType,
    party_name: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.business_id == user.business_id)
        .filter(LedgerEntry.ledger_type == ledger_type)
        .order_by(LedgerEntry.created_at.desc())
    )

    if party_name:
        q = q.filter(LedgerEntry.party_name_hash == pii_hash(party_name))

    rows = q.limit(200).all()

    return [
        LedgerEntryOut(
            id=r.id,
            ledger_type=r.ledger_type,
            party_name=pii_decrypt(r.party_name_enc) or "",
            amount=float(r.amount),
            note=r.note,
        )
        for r in rows
    ]


@router.get("/balances", response_model=list[LedgerPartyBalance])
def balances(
    ledger_type: LedgerType,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Returns a quick balance view: total per party.
    rows = (
        db.query(LedgerEntry.party_name_hash, func.sum(LedgerEntry.amount))
        .filter(LedgerEntry.business_id == user.business_id)
        .filter(LedgerEntry.ledger_type == ledger_type)
        .group_by(LedgerEntry.party_name_hash)
        .all()
    )

    # We intentionally do not decode party_name from hash alone.
    # To show names, we fetch one representative encrypted name for each hash.
    result: list[LedgerPartyBalance] = []
    for party_hash, total in rows:
        sample = (
            db.query(LedgerEntry)
            .filter(LedgerEntry.business_id == user.business_id)
            .filter(LedgerEntry.ledger_type == ledger_type)
            .filter(LedgerEntry.party_name_hash == party_hash)
            .order_by(LedgerEntry.id.desc())
            .first()
        )
        name = pii_decrypt(sample.party_name_enc) if sample else ""
        result.append(LedgerPartyBalance(party_name=name or "", balance=float(total or 0)))

    result.sort(key=lambda x: x.balance, reverse=True)
    return result
