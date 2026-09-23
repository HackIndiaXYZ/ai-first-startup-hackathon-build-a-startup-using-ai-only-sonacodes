from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_membership
from app.models.business import BusinessMembership
from app.models.closing import DailyClosing
from app.schemas import ClosingCreate, ClosingOut
from app.services.closing import close_day, preview_closing

router = APIRouter(prefix="/daily-closing", tags=["daily-closing"])


@router.get("")
def get_closing_preview(
    business_date: date | None = Query(default=None),
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    target = business_date or date.today()
    return preview_closing(db, membership.business_id, target)


@router.get("/history", response_model=list[ClosingOut])
def closing_history(
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    return list(
        db.scalars(
            select(DailyClosing)
            .where(DailyClosing.business_id == membership.business_id)
            .order_by(DailyClosing.business_date.desc())
        ).all()
    )


@router.post("", response_model=ClosingOut, status_code=201)
def post_closing(
    payload: ClosingCreate,
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    return close_day(
        db,
        business_id=membership.business_id,
        business_date=payload.business_date,
        closed_by=membership.user_id,
        notes=payload.notes,
    )
