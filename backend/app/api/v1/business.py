from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import AppError
from app.core.security import get_current_membership, get_current_user
from app.models.business import Business, BusinessCounter, BusinessMembership
from app.models.enums import MembershipRole
from app.models.user import User
from app.schemas import BusinessCreate, BusinessOut, BusinessUpdate

router = APIRouter(prefix="/business", tags=["business"])


@router.get("", response_model=BusinessOut)
def get_business(
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    business = db.get(Business, membership.business_id)
    if business is None:
        raise AppError(404, "NO_BUSINESS", "Set up your business to continue.")
    out = BusinessOut.model_validate(business)
    out.role = membership.role
    return out


@router.post("", response_model=BusinessOut, status_code=201)
def create_business(
    payload: BusinessCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.scalars(
        select(BusinessMembership).where(BusinessMembership.user_id == user.id)
    ).first()
    if existing:
        raise AppError(409, "BUSINESS_EXISTS", "You already have a business in this version.")
    business = Business(**payload.model_dump())
    db.add(business)
    db.flush()
    db.add(
        BusinessMembership(
            business_id=business.id,
            user_id=user.id,
            role=MembershipRole.OWNER,
        )
    )
    db.add(BusinessCounter(business_id=business.id, next_invoice_seq=1))
    db.flush()
    out = BusinessOut.model_validate(business)
    out.role = MembershipRole.OWNER
    return out


@router.patch("", response_model=BusinessOut)
def update_business(
    payload: BusinessUpdate,
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    business = db.get(Business, membership.business_id)
    if business is None:
        raise AppError(404, "NO_BUSINESS", "Business not found.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(business, key, value)
    db.flush()
    out = BusinessOut.model_validate(business)
    out.role = membership.role
    return out
