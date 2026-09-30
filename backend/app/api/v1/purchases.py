from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.db import get_db
from app.core.errors import AppError
from app.core.security import get_current_membership
from app.models.business import BusinessMembership
from app.models.purchase import Purchase
from app.schemas import PurchaseCreate, PurchaseOut
from app.services.purchases import create_purchase

router = APIRouter(prefix="/purchases", tags=["purchases"])


@router.get("", response_model=list[PurchaseOut])
def list_purchases(
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    return list(
        db.scalars(
            select(Purchase)
            .options(selectinload(Purchase.items))
            .where(Purchase.business_id == membership.business_id)
            .order_by(Purchase.created_at.desc())
        ).all()
    )


@router.post("", response_model=PurchaseOut, status_code=201)
def post_purchase(
    payload: PurchaseCreate,
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    return create_purchase(
        db,
        business_id=membership.business_id,
        items=[item.model_dump() for item in payload.items],
        supplier_name=payload.supplier_name,
        invoice_number=payload.invoice_number,
        tax=payload.tax,
        payment_status=payload.payment_status,
        notes=payload.notes,
        created_by=membership.user_id,
    )


@router.get("/{purchase_id}", response_model=PurchaseOut)
def get_purchase(
    purchase_id: UUID,
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    purchase = db.scalars(
        select(Purchase)
        .options(selectinload(Purchase.items))
        .where(Purchase.id == purchase_id, Purchase.business_id == membership.business_id)
    ).first()
    if purchase is None:
        raise AppError(404, "PURCHASE_NOT_FOUND", "Purchase not found.")
    return purchase
