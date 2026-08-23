from datetime import datetime, time

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user
from backend.app.core.db import get_db
from backend.app.core.pii_crypto import pii_decrypt, pii_encrypt, pii_hash
from backend.app.core.push import enqueue_push
from backend.app.models.entities import DeviceToken, LedgerEntry, LedgerType, User, UserRole
from backend.app.schemas.ledger import LedgerEntryCreate, LedgerEntryOut, LedgerPartyBalance, LedgerStatementOut

router = APIRouter()


def _end_of_day(end_date: datetime | None) -> datetime | None:
    if end_date and end_date.time() == time.min:
        return end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
    return end_date


@router.post("/entries", response_model=LedgerEntryOut)
def create_entry(
    payload: LedgerEntryCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Continuous ledger approach:
    # - Positive `amount` means the party owes the business (customer credit) or business owes the party (supplier credit).
    # - Negative `amount` means a payment was made to reduce the balance.
    # This avoids closing cycles and stays simple for local users.

    entry = LedgerEntry(
        business_id=user.business_id,
        branch_id=user.branch_id,
        ledger_type=payload.ledger_type,
        party_name_enc=pii_encrypt(payload.party_name) or "",
        party_name_hash=pii_hash(payload.party_name),
        amount=payload.amount,
        note=payload.note,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    if payload.amount < 0 and payload.ledger_type == LedgerType.customer:
        boss_ids = [
            u.id
            for u in db.query(User)
            .filter(User.business_id == user.business_id)
            .filter(User.role == UserRole.boss)
            .all()
        ]
        tokens = (
            [t.token for t in db.query(DeviceToken).filter(DeviceToken.user_id.in_(boss_ids)).all()]
            if boss_ids
            else []
        )
        if tokens:
            enqueue_push(background_tasks, tokens, title="Payment Received", body=f"Customer {payload.party_name} paid {abs(float(payload.amount)):.2f}.")

    return LedgerEntryOut(
        id=entry.id,
        ledger_type=entry.ledger_type,
        party_name=pii_decrypt(entry.party_name_enc) or "",
        amount=float(entry.amount),
        note=entry.note,
        created_at=entry.created_at,
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
    if user.branch_id is not None:
        q = q.filter(LedgerEntry.branch_id == user.branch_id)

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
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/balances", response_model=list[LedgerPartyBalance])
def balances(
    ledger_type: LedgerType,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    limit = max(1, min(int(limit), 50))
    offset = max(0, int(offset))

    # Returns a quick balance view: total per party.
    base_q = (
        db.query(LedgerEntry.party_name_hash, func.sum(LedgerEntry.amount))
        .filter(LedgerEntry.business_id == user.business_id)
        .filter(LedgerEntry.ledger_type == ledger_type)
    )
    if user.branch_id is not None:
        base_q = base_q.filter(LedgerEntry.branch_id == user.branch_id)
    rows = (
        base_q.group_by(LedgerEntry.party_name_hash)
        .order_by(func.sum(LedgerEntry.amount).desc())
        .offset(offset)
        .limit(limit)
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


@router.get("/statement", response_model=LedgerStatementOut)
def statement(
    ledger_type: LedgerType,
    party_name: str,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    limit = max(1, min(int(limit), 50))
    offset = max(0, int(offset))

    party_hash = pii_hash(party_name)

    # 1. Opening balance: sum of entries before start_date
    opening_balance = 0.0
    if start_date:
        ob_q = (
            db.query(func.sum(LedgerEntry.amount))
            .filter(LedgerEntry.business_id == user.business_id)
            .filter(LedgerEntry.ledger_type == ledger_type)
            .filter(LedgerEntry.party_name_hash == party_hash)
            .filter(LedgerEntry.created_at < start_date)
        )
        if user.branch_id is not None:
            ob_q = ob_q.filter(LedgerEntry.branch_id == user.branch_id)
        opening_balance = float(ob_q.scalar() or 0.0)

    # 2. Outstanding balance: sum of all entries ever
    out_q = (
        db.query(func.sum(LedgerEntry.amount))
        .filter(LedgerEntry.business_id == user.business_id)
        .filter(LedgerEntry.ledger_type == ledger_type)
        .filter(LedgerEntry.party_name_hash == party_hash)
    )
    if user.branch_id is not None:
        out_q = out_q.filter(LedgerEntry.branch_id == user.branch_id)
    outstanding_balance = float(out_q.scalar() or 0.0)

    # 3. Entries within date range
    q = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.business_id == user.business_id)
        .filter(LedgerEntry.ledger_type == ledger_type)
        .filter(LedgerEntry.party_name_hash == party_hash)
    )
    if user.branch_id is not None:
        q = q.filter(LedgerEntry.branch_id == user.branch_id)
    if start_date:
        q = q.filter(LedgerEntry.created_at >= start_date)
    if end_date:
        q = q.filter(LedgerEntry.created_at <= _end_of_day(end_date))
    rows = q.order_by(LedgerEntry.created_at.asc(), LedgerEntry.id.asc()).offset(offset).limit(limit).all()

    skip_sum = 0.0
    if rows:
        oldest_in_batch = rows[0]
        # Sum of all entries in the date range that are STRICTLY OLDER than the oldest in this batch
        older_q = q.filter(
            (LedgerEntry.created_at < oldest_in_batch.created_at) | 
            ((LedgerEntry.created_at == oldest_in_batch.created_at) & (LedgerEntry.id < oldest_in_batch.id))
        )
        skip_sum = float(older_q.with_entities(func.sum(LedgerEntry.amount)).scalar() or 0.0)

    total_credit_sales = 0.0
    total_payments = 0.0
    current_balance = opening_balance + skip_sum
    entries_out: list[LedgerEntryOut] = []

    for r in rows:
        amount = float(r.amount)
        current_balance += amount
        if amount > 0:
            total_credit_sales += amount
        else:
            total_payments += abs(amount)

        entries_out.append(
            LedgerEntryOut(
                id=r.id,
                ledger_type=r.ledger_type,
                party_name=party_name,
                amount=amount,
                note=r.note,
                created_at=r.created_at,
                running_balance=current_balance,
            )
        )

    return LedgerStatementOut(
        opening_balance=opening_balance,
        total_credit_sales=total_credit_sales,
        total_payments=total_payments,
        closing_balance=current_balance,
        outstanding_balance=outstanding_balance,
        entries=entries_out,
    )

