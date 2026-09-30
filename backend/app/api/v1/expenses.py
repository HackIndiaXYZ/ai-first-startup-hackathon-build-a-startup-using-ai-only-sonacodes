from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import AppError
from app.core.security import get_current_membership
from app.models.business import BusinessMembership
from app.models.expense import Expense
from app.schemas import ExpenseCreate, ExpenseOut
from app.services.inventory import quantize_money

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.get("", response_model=list[ExpenseOut])
def list_expenses(
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    return list(
        db.scalars(
            select(Expense)
            .where(Expense.business_id == membership.business_id)
            .order_by(Expense.expense_date.desc(), Expense.created_at.desc())
        ).all()
    )


@router.post("", response_model=ExpenseOut, status_code=201)
def create_expense(
    payload: ExpenseCreate,
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    if payload.amount <= 0:
        raise AppError(400, "INVALID_AMOUNT", "Amount must be greater than zero.")
    expense = Expense(
        business_id=membership.business_id,
        category=payload.category,
        amount=quantize_money(payload.amount),
        payment_method=payload.payment_method,
        description=payload.description,
        expense_date=payload.expense_date,
    )
    db.add(expense)
    db.flush()
    return expense
