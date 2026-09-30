from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.enums import StockTransactionType
from app.models.product import Product
from app.models.stock import StockTransaction

QTY = Decimal("0.001")
MONEY = Decimal("0.01")

OUTFLOW_TYPES = {
    StockTransactionType.SALE,
    StockTransactionType.DAMAGE,
    StockTransactionType.EXPIRY,
}
INFLOW_TYPES = {
    StockTransactionType.OPENING,
    StockTransactionType.PURCHASE,
    StockTransactionType.RETURN,
}


def quantize_qty(value: Decimal) -> Decimal:
    return Decimal(value).quantize(QTY)


def quantize_money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(MONEY)


def lock_product(db: Session, business_id: UUID, product_id: UUID) -> Product:
    product = db.scalars(
        select(Product)
        .where(Product.id == product_id, Product.business_id == business_id)
        .with_for_update()
    ).first()
    if product is None:
        raise AppError(404, "PRODUCT_NOT_FOUND", "Product not found.")
    return product


def get_current_stock(db: Session, business_id: UUID, product_id: UUID) -> Decimal:
    total = db.scalar(
        select(func.coalesce(func.sum(StockTransaction.quantity), 0)).where(
            StockTransaction.business_id == business_id,
            StockTransaction.product_id == product_id,
        )
    )
    return quantize_qty(Decimal(total or 0))


def get_all_current_stock(db: Session, business_id: UUID) -> dict[UUID, Decimal]:
    rows = db.execute(
        select(
            StockTransaction.product_id,
            func.coalesce(func.sum(StockTransaction.quantity), 0),
        )
        .where(StockTransaction.business_id == business_id)
        .group_by(StockTransaction.product_id)
    ).all()
    return {product_id: quantize_qty(Decimal(qty)) for product_id, qty in rows}


def get_stock_history(db: Session, business_id: UUID, product_id: UUID) -> list[StockTransaction]:
    return list(
        db.scalars(
            select(StockTransaction)
            .where(
                StockTransaction.business_id == business_id,
                StockTransaction.product_id == product_id,
            )
            .order_by(StockTransaction.created_at.desc())
        ).all()
    )


def get_stock_value(db: Session, business_id: UUID) -> Decimal:
    rows = db.execute(
        select(
            Product.purchase_price,
            func.coalesce(func.sum(StockTransaction.quantity), 0),
        )
        .join(Product, Product.id == StockTransaction.product_id)
        .where(StockTransaction.business_id == business_id)
        .group_by(Product.id, Product.purchase_price)
    ).all()
    total = Decimal("0")
    for purchase_price, qty in rows:
        total += Decimal(purchase_price) * Decimal(qty)
    return quantize_money(total)


def get_total_units(db: Session, business_id: UUID) -> Decimal:
    total = db.scalar(
        select(func.coalesce(func.sum(StockTransaction.quantity), 0)).where(
            StockTransaction.business_id == business_id
        )
    )
    return quantize_qty(Decimal(total or 0))


def get_low_stock_products(db: Session, business_id: UUID) -> list[tuple[Product, Decimal]]:
    products = db.scalars(
        select(Product).where(Product.business_id == business_id, Product.active.is_(True))
    ).all()
    stock = get_all_current_stock(db, business_id)
    result = []
    for product in products:
        qty = stock.get(product.id, Decimal("0"))
        min_stock = Decimal(product.minimum_stock)
        if qty > 0 and min_stock > 0 and qty <= min_stock:
            result.append((product, qty))
    return result


def get_out_of_stock_products(db: Session, business_id: UUID) -> list[tuple[Product, Decimal]]:
    products = db.scalars(
        select(Product).where(Product.business_id == business_id, Product.active.is_(True))
    ).all()
    stock = get_all_current_stock(db, business_id)
    result = []
    for product in products:
        qty = stock.get(product.id, Decimal("0"))
        if qty <= 0:
            result.append((product, qty))
    return result


def _signed_quantity(txn_type: StockTransactionType, quantity: Decimal) -> Decimal:
    qty = quantize_qty(quantity)
    if qty == 0:
        raise AppError(400, "INVALID_QUANTITY", "Quantity cannot be zero.")
    if txn_type in OUTFLOW_TYPES:
        return -abs(qty)
    if txn_type in INFLOW_TYPES:
        return abs(qty)
    # ADJUSTMENT: keep the sign the caller sent
    return qty


def add_stock_transaction(
    db: Session,
    *,
    business_id: UUID,
    product_id: UUID,
    transaction_type: StockTransactionType,
    quantity: Decimal,
    created_by: UUID | None = None,
    unit_cost: Decimal | None = None,
    reference_type: str | None = None,
    reference_id: UUID | None = None,
    reason: str | None = None,
    notes: str | None = None,
    allow_negative: bool = False,
) -> StockTransaction:
    product = lock_product(db, business_id, product_id)
    signed = _signed_quantity(transaction_type, quantity)
    current = get_current_stock(db, business_id, product_id)
    projected = current + signed
    if not allow_negative and projected < 0:
        raise AppError(
            409,
            "INSUFFICIENT_STOCK",
            f"Not enough {product.name}. Available: {current}.",
            details={"product_id": str(product_id), "available": str(current)},
        )
    txn = StockTransaction(
        business_id=business_id,
        product_id=product_id,
        transaction_type=transaction_type,
        quantity=signed,
        unit_cost=quantize_money(unit_cost) if unit_cost is not None else product.purchase_price,
        reference_type=reference_type,
        reference_id=reference_id,
        reason=reason,
        notes=notes,
        created_by=created_by,
    )
    db.add(txn)
    db.flush()
    return txn
