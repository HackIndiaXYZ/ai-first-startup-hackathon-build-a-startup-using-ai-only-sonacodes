from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_membership
from app.models.business import BusinessMembership
from app.models.enums import StockTransactionType
from app.models.product import Product
from app.models.stock import StockTransaction
from app.schemas import AdjustmentIn, OpeningStockIn, StockTxnOut
from app.services.inventory import (
    add_stock_transaction,
    get_all_current_stock,
    get_low_stock_products,
    get_out_of_stock_products,
    get_stock_value,
)

router = APIRouter(prefix="/stock", tags=["stock"])


@router.get("")
def stock_overview(
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    products = list(
        db.scalars(
            select(Product)
            .where(Product.business_id == membership.business_id, Product.active.is_(True))
            .order_by(Product.name)
        ).all()
    )
    stock = get_all_current_stock(db, membership.business_id)
    items = []
    for product in products:
        qty = stock.get(product.id, Decimal("0"))
        status = "ok"
        if qty <= 0:
            status = "out"
        elif product.minimum_stock and qty <= product.minimum_stock:
            status = "low"
        items.append(
            {
                "product_id": product.id,
                "name": product.name,
                "unit": product.unit,
                "quantity": qty,
                "minimum_stock": product.minimum_stock,
                "purchase_price": product.purchase_price,
                "value": (qty * product.purchase_price).quantize(Decimal("0.01")),
                "status": status,
            }
        )
    recent = db.scalars(
        select(StockTransaction)
        .where(StockTransaction.business_id == membership.business_id)
        .order_by(StockTransaction.created_at.desc())
        .limit(20)
    ).all()
    names = {p.id: p.name for p in products}
    return {
        "stock_value": get_stock_value(db, membership.business_id),
        "low_stock_count": len(get_low_stock_products(db, membership.business_id)),
        "out_of_stock_count": len(get_out_of_stock_products(db, membership.business_id)),
        "items": items,
        "recent": [
            {**StockTxnOut.model_validate(t).model_dump(), "product_name": names.get(t.product_id)}
            for t in recent
        ],
    }


@router.post("/opening", response_model=StockTxnOut, status_code=201)
def opening_stock(
    payload: OpeningStockIn,
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    txn = add_stock_transaction(
        db,
        business_id=membership.business_id,
        product_id=payload.product_id,
        transaction_type=StockTransactionType.OPENING,
        quantity=payload.quantity,
        created_by=membership.user_id,
        unit_cost=payload.unit_cost,
        reference_type="opening",
        notes=payload.notes,
    )
    return txn


@router.post("/adjustments", response_model=StockTxnOut, status_code=201)
def adjust_stock(
    payload: AdjustmentIn,
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    allowed = {
        StockTransactionType.ADJUSTMENT,
        StockTransactionType.DAMAGE,
        StockTransactionType.EXPIRY,
    }
    txn_type = payload.transaction_type
    if txn_type not in allowed:
        txn_type = StockTransactionType.ADJUSTMENT
    txn = add_stock_transaction(
        db,
        business_id=membership.business_id,
        product_id=payload.product_id,
        transaction_type=txn_type,
        quantity=payload.quantity,
        created_by=membership.user_id,
        reference_type="adjustment",
        reason=payload.reason,
        notes=payload.notes,
    )
    return txn
