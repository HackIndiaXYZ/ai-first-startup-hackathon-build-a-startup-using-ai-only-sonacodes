from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_membership
from app.models.business import BusinessMembership
from app.services.dashboard import dashboard_summary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def get_dashboard(
    business_date: date | None = Query(default=None),
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    return dashboard_summary(db, membership.business_id, business_date or date.today())
