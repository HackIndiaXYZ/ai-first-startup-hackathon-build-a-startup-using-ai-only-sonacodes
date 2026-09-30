from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import AppError
from app.core.security import get_current_membership
from app.models.business import BusinessMembership
from app.models.product import CustomFieldDefinition
from app.schemas import CustomFieldCreate, CustomFieldOut

router = APIRouter(prefix="/custom-fields", tags=["custom-fields"])


@router.get("", response_model=list[CustomFieldOut])
def list_fields(
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    return list(
        db.scalars(
            select(CustomFieldDefinition)
            .where(CustomFieldDefinition.business_id == membership.business_id)
            .order_by(CustomFieldDefinition.name)
        ).all()
    )


@router.post("", response_model=CustomFieldOut, status_code=201)
def create_field(
    payload: CustomFieldCreate,
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    existing = db.scalars(
        select(CustomFieldDefinition).where(
            CustomFieldDefinition.business_id == membership.business_id,
            CustomFieldDefinition.name == payload.name.strip(),
        )
    ).first()
    if existing:
        raise AppError(409, "FIELD_EXISTS", "That field already exists.")
    field = CustomFieldDefinition(
        business_id=membership.business_id,
        name=payload.name.strip(),
    )
    db.add(field)
    db.flush()
    return field


@router.delete("/{field_id}", status_code=204)
def delete_field(
    field_id: str,
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    field = db.scalars(
        select(CustomFieldDefinition).where(
            CustomFieldDefinition.id == field_id,
            CustomFieldDefinition.business_id == membership.business_id,
        )
    ).first()
    if field is None:
        raise AppError(404, "FIELD_NOT_FOUND", "Field not found.")
    db.delete(field)
    db.flush()
