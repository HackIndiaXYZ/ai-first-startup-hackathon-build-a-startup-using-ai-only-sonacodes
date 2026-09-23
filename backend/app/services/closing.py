from datetime import date, datetime, time
from decimal import Decimal
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.closing import DailyClosing
from app.models.enums import StockTransactionType
from app.models.expense import Expense
from app.models.purchase import Purchase
from app.models.sale import Sale
from app.models.stock import StockTransaction
from app.services.inventory import get_stock_value, get_total_units, quantize_money

IST = ZoneInfo("Asia/Kolkata")
ADJUSTMENT_TYPES = {
    StockTransactionType.ADJUSTMENT,
    StockTransactionType.DAMAGE,
    StockTransactionType.EXPIRY,
}


def day_bounds(business_date: date) -> tuple[datetime, datetime]:
    start = datetime.combine(business_date, time.min, tzinfo=IST)
    end = datetime.combine(business_date, time.max, tzinfo=IST)
    return start, end


def previous_closing(db: Session, business_id: UUID, business_date: date) -> DailyClosing | None:
    return db.scalars(
        select(DailyClosing)
        .where(
            DailyClosing.business_id == business_id,
            DailyClosing.business_date < business_date,
        )
        .order_by(DailyClosing.business_date.desc())
    ).first()


def _sum_money(db: Session, stmt) -> Decimal:
    value = db.scalar(stmt)
    return quantize_money(Decimal(value or 0))


def preview_closing(db: Session, business_id: UUID, business_date: date) -> dict:
    existing = db.scalars(
        select(DailyClosing).where(
            DailyClosing.business_id == business_id,
            DailyClosing.business_date == business_date,
        )
    ).first()
    start, end = day_bounds(business_date)
    prev = previous_closing(db, business_id, business_date)
    if prev is not None:
        opening = prev.closing_stock_value
    else:
        opening = Decimal("0")

    sales_value = _sum_money(
        db,
        select(func.coalesce(func.sum(Sale.total), 0)).where(
            Sale.business_id == business_id,
            Sale.created_at >= start,
            Sale.created_at <= end,
        ),
    )
    purchases_value = _sum_money(
        db,
        select(func.coalesce(func.sum(Purchase.total), 0)).where(
            Purchase.business_id == business_id,
            Purchase.created_at >= start,
            Purchase.created_at <= end,
        ),
    )
    expenses_value = _sum_money(
        db,
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.business_id == business_id,
            Expense.expense_date == business_date,
        ),
    )

    adj_rows = db.execute(
        select(StockTransaction.quantity, StockTransaction.unit_cost).where(
            StockTransaction.business_id == business_id,
            StockTransaction.transaction_type.in_(ADJUSTMENT_TYPES),
            StockTransaction.created_at >= start,
            StockTransaction.created_at <= end,
        )
    ).all()
    adjustments_value = Decimal("0")
    for qty, unit_cost in adj_rows:
        adjustments_value += Decimal(qty) * Decimal(unit_cost or 0)
    adjustments_value = quantize_money(adjustments_value)

    closing_stock_value = get_stock_value(db, business_id)
    total_units = get_total_units(db, business_id)

    return {
        "business_date": business_date,
        "already_closed": existing is not None,
        "opening_stock_value": quantize_money(Decimal(opening)),
        "purchases_value": purchases_value,
        "sales_value": sales_value,
        "expenses_value": expenses_value,
        "adjustments_value": adjustments_value,
        "closing_stock_value": closing_stock_value,
        "total_units": total_units,
        "previous_closing_date": prev.business_date if prev else None,
    }


def close_day(
    db: Session,
    *,
    business_id: UUID,
    business_date: date,
    closed_by: UUID,
    notes: str | None = None,
) -> DailyClosing:
    snapshot = preview_closing(db, business_id, business_date)
    if snapshot["already_closed"]:
        raise AppError(409, "DAY_ALREADY_CLOSED", "This day is already closed.")
    row = DailyClosing(
        business_id=business_id,
        business_date=business_date,
        opening_stock_value=snapshot["opening_stock_value"],
        purchases_value=snapshot["purchases_value"],
        sales_value=snapshot["sales_value"],
        expenses_value=snapshot["expenses_value"],
        adjustments_value=snapshot["adjustments_value"],
        closing_stock_value=snapshot["closing_stock_value"],
        total_units=snapshot["total_units"],
        closed_by=closed_by,
        notes=notes,
    )
    db.add(row)
    db.flush()
    return row
