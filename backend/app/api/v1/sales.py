from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.db import get_db
from app.core.errors import AppError
from app.core.security import get_current_membership
from app.models.business import Business, BusinessMembership
from app.models.product import Product
from app.models.sale import Sale
from app.pdf.invoice import build_invoice_pdf
from app.schemas import SaleCreate, SaleOut
from app.services.sales import create_sale

router = APIRouter(prefix="/sales", tags=["sales"])


@router.get("", response_model=list[SaleOut])
def list_sales(
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    return list(
        db.scalars(
            select(Sale)
            .options(selectinload(Sale.items))
            .where(Sale.business_id == membership.business_id)
            .order_by(Sale.created_at.desc())
        ).all()
    )


@router.post("", response_model=SaleOut, status_code=201)
def post_sale(
    payload: SaleCreate,
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    business = db.get(Business, membership.business_id)
    if business is None:
        raise AppError(404, "NO_BUSINESS", "Business not found.")
    return create_sale(
        db,
        business=business,
        created_by=membership.user_id,
        items=[item.model_dump() for item in payload.items],
        discount=payload.discount,
        payment_method=payload.payment_method,
        payment_status=payload.payment_status,
        notes=payload.notes,
    )


@router.get("/{sale_id}", response_model=SaleOut)
def get_sale(
    sale_id: UUID,
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    sale = db.scalars(
        select(Sale)
        .options(selectinload(Sale.items))
        .where(Sale.id == sale_id, Sale.business_id == membership.business_id)
    ).first()
    if sale is None:
        raise AppError(404, "SALE_NOT_FOUND", "Bill not found.")
    return sale


@router.get("/{sale_id}/invoice.pdf")
def sale_invoice_pdf(
    sale_id: UUID,
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    sale = db.scalars(
        select(Sale)
        .options(selectinload(Sale.items))
        .where(Sale.id == sale_id, Sale.business_id == membership.business_id)
    ).first()
    if sale is None:
        raise AppError(404, "SALE_NOT_FOUND", "Bill not found.")
    business = db.get(Business, membership.business_id)
    product_ids = [item.product_id for item in sale.items]
    products = {
        p.id: p
        for p in db.scalars(select(Product).where(Product.id.in_(product_ids))).all()
    }
    pdf = build_invoice_pdf(business, sale, products)
    filename = f"{sale.invoice_number}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
