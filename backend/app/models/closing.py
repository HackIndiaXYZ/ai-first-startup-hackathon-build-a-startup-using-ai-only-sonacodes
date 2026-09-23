from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class DailyClosing(Base):
    __tablename__ = "daily_closings"
    __table_args__ = (UniqueConstraint("business_id", "business_date", name="uq_closing_business_date"),)

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    business_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False
    )
    business_date: Mapped[date] = mapped_column(Date, nullable=False)
    opening_stock_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    purchases_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    sales_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    expenses_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    adjustments_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    closing_stock_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total_units: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    closed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    closed_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    notes: Mapped[str | None] = mapped_column(Text)
