from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import AppError
from app.core.security import get_current_membership
from app.models.business import BusinessMembership
from app.models.enums import StockTransactionType
from app.models.product import Product
from app.models.purchase import PurchaseItem
from app.models.sale import Sale, SaleItem
from app.schemas import ProductCreate, ProductOut, ProductUpdate, StockTxnOut
from app.services.inventory import add_stock_transaction, get_all_current_stock, get_current_stock, get_stock_history

router = APIRouter(prefix="/products", tags=["products"])


def _sku(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _to_out(product: Product, stock: Decimal) -> ProductOut:
    data = ProductOut.model_validate(product)
    data.current_stock = stock
    return data


@router.get("", response_model=list[ProductOut])
def list_products(
    q: str | None = None,
    category_id: UUID | None = None,
    active: bool | None = True,
    include_archived: bool = False,
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    stmt = select(Product).where(Product.business_id == membership.business_id)
    if include_archived:
        if active is False:
            stmt = stmt.where(Product.active.is_(False))
    else:
        stmt = stmt.where(Product.active.is_(True))
    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Product.name.ilike(like),
                Product.sku.ilike(like),
                Product.barcode.ilike(like),
            )
        )
    products = list(db.scalars(stmt.order_by(Product.name)).all())
    stock = get_all_current_stock(db, membership.business_id)
    return [_to_out(p, stock.get(p.id, Decimal("0"))) for p in products]


@router.post("", response_model=ProductOut, status_code=201)
def create_product(
    payload: ProductCreate,
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude={"opening_stock"})
    data["sku"] = _sku(data.get("sku"))
    data["business_id"] = membership.business_id
    product = Product(**data)
    db.add(product)
    db.flush()
    if payload.opening_stock and payload.opening_stock > 0:
        add_stock_transaction(
            db,
            business_id=membership.business_id,
            product_id=product.id,
            transaction_type=StockTransactionType.OPENING,
            quantity=payload.opening_stock,
            created_by=membership.user_id,
            unit_cost=product.purchase_price,
            reference_type="opening",
            reference_id=product.id,
        )
    return _to_out(product, get_current_stock(db, membership.business_id, product.id))


@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: UUID,
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    product = db.scalars(
        select(Product).where(Product.id == product_id, Product.business_id == membership.business_id)
    ).first()
    if product is None:
        raise AppError(404, "PRODUCT_NOT_FOUND", "Product not found.")
    return _to_out(product, get_current_stock(db, membership.business_id, product.id))


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: UUID,
    payload: ProductUpdate,
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    product = db.scalars(
        select(Product).where(Product.id == product_id, Product.business_id == membership.business_id)
    ).first()
    if product is None:
        raise AppError(404, "PRODUCT_NOT_FOUND", "Product not found.")
    updates = payload.model_dump(exclude_unset=True)
    if "sku" in updates:
        updates["sku"] = _sku(updates["sku"])
    for key, value in updates.items():
        setattr(product, key, value)
    db.flush()
    return _to_out(product, get_current_stock(db, membership.business_id, product.id))


@router.get("/{product_id}/history")
def product_history(
    product_id: UUID,
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    product = db.scalars(
        select(Product).where(Product.id == product_id, Product.business_id == membership.business_id)
    ).first()
    if product is None:
        raise AppError(404, "PRODUCT_NOT_FOUND", "Product not found.")
    txns = get_stock_history(db, membership.business_id, product_id)
    sales = db.execute(
        select(Sale, SaleItem)
        .join(SaleItem, SaleItem.sale_id == Sale.id)
        .where(Sale.business_id == membership.business_id, SaleItem.product_id == product_id)
        .order_by(Sale.created_at.desc())
        .limit(50)
    ).all()
    purchases = db.scalars(
        select(PurchaseItem)
        .where(PurchaseItem.product_id == product_id)
        .order_by(PurchaseItem.id.desc())
        .limit(50)
    ).all()
    return {
        "stock": [StockTxnOut.model_validate(t) for t in txns],
        "sales": [
            {
                "sale_id": sale.id,
                "invoice_number": sale.invoice_number,
                "quantity": item.quantity,
                "total": item.total,
                "created_at": sale.created_at,
            }
            for sale, item in sales
        ],
        "purchases": [
            {
                "id": item.id,
                "purchase_id": item.purchase_id,
                "quantity": item.quantity,
                "unit_cost": item.unit_cost,
                "total": item.total,
            }
            for item in purchases
        ],
    }
