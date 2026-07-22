import enum
from datetime import datetime, date

from sqlalchemy import String, DateTime, Date, ForeignKey, Integer, Numeric, Enum, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base


class UserRole(str, enum.Enum):
    boss = "boss"
    user = "user"


class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone_enc: Mapped[str | None] = mapped_column(String(500), nullable=True)
    phone_hash: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    paid_amount_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    users: Mapped[list["User"]] = relationship(back_populates="business")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=False)

    email_enc: Mapped[str] = mapped_column(String(500), nullable=False)
    email_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    business: Mapped[Business] = relationship(back_populates="users")


class DeviceToken(Base):
    __tablename__ = "device_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)

    token: Mapped[str] = mapped_column(String(512), unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    sku: Mapped[str | None] = mapped_column(String(64), nullable=True)
    unit: Mapped[str] = mapped_column(String(50), default="unit")

    units: Mapped[list["ProductUnit"]] = relationship(back_populates="product")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class ProductUnit(Base):
    __tablename__ = "product_units"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)

    # Example: base unit = "piece" (factor=1), carton = 300 pieces (factor=300)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    factor_to_base: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_base: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    product: Mapped[Product] = relationship(back_populates="units")


class StockBatch(Base):
    __tablename__ = "stock_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)

    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    cost_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    momo = "momo"


class Sale(Base):
    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    payment_method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod), nullable=False)
    is_credit: Mapped[bool] = mapped_column(Boolean, default=False)
    customer_name_enc: Mapped[str | None] = mapped_column(String(500), nullable=True)

    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    items: Mapped[list["SaleItem"]] = relationship(back_populates="sale")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id"), nullable=False, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)

    # Stored in base units (integer) for correct stock deduction.
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    # User-entered unit/quantity for reporting/UX (e.g. 1.5 kg, 1 carton).
    display_unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    display_quantity: Mapped[float | None] = mapped_column(Numeric(12, 3), nullable=True)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    line_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    sale: Mapped[Sale] = relationship(back_populates="items")


class LedgerType(str, enum.Enum):
    supplier = "supplier"
    customer = "customer"


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)

    ledger_type: Mapped[LedgerType] = mapped_column(Enum(LedgerType), nullable=False)
    party_name_enc: Mapped[str] = mapped_column(String(500), nullable=False)
    party_name_hash: Mapped[str] = mapped_column(String(64), index=True, nullable=False)

    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
