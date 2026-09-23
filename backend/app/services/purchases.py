from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import AppError
from app.models.enums import PaymentStatus, StockTransactionType
from app.models.product import Product
from app.models.purchase import Purchase, PurchaseItem
from app.services.inventory import add_stock_transaction, quantize_money, quantize_qty


def create_purchase(
    db: Session,
    *,
    business_id: UUID,
    items: list[dict],
    supplier_name: str | None = None,
    invoice_number: str | None = None,
    tax: Decimal = Decimal("0"),
    payment_status: PaymentStatus = PaymentStatus.PAID,
    notes: str | None = None,
    created_by: UUID | None = None,
) -> Purchase:
    if not items:
        raise AppError(400, "EMPTY_PURCHASE", "Add at least one product to the purchase.")

    tax = quantize_money(tax)
    if tax < 0:
        raise AppError(400, "INVALID_TAX", "Tax cannot be negative.")

    product_ids = []
    parsed_items = []
    for raw in items:
        product_id = raw["product_id"] if isinstance(raw["product_id"], UUID) else UUID(str(raw["product_id"]))
        qty = quantize_qty(Decimal(str(raw["quantity"])))
        if qty <= 0:
            raise AppError(400, "INVALID_QUANTITY", "Quantity must be greater than zero.")
        unit_cost = quantize_money(Decimal(str(raw["unit_cost"])))
        if unit_cost < 0:
            raise AppError(400, "INVALID_COST", "Cost cannot be negative.")
        product_ids.append(product_id)
        parsed_items.append((product_id, qty, unit_cost))

    products = {
        p.id: p
        for p in db.scalars(
            select(Product).where(Product.business_id == business_id, Product.id.in_(product_ids))
        ).all()
    }
    if len(products) != len(set(product_ids)):
        raise AppError(400, "PRODUCT_NOT_FOUND", "One or more products were not found.")

    subtotal = Decimal("0")
    line_rows = []
    for product_id, qty, unit_cost in parsed_items:
        line_total = quantize_money(unit_cost * qty)
        subtotal += line_total
        line_rows.append((products[product_id], qty, unit_cost, line_total))
    subtotal = quantize_money(subtotal)
    total = quantize_money(subtotal + tax)

    purchase = Purchase(
        business_id=business_id,
        supplier_name=supplier_name,
        invoice_number=invoice_number,
        subtotal=subtotal,
        tax=tax,
        total=total,
        payment_status=payment_status,
        notes=notes,
    )
    db.add(purchase)
    db.flush()

    for product, qty, unit_cost, line_total in line_rows:
        db.add(
            PurchaseItem(
                purchase_id=purchase.id,
                product_id=product.id,
                quantity=qty,
                unit_cost=unit_cost,
                tax=Decimal("0"),
                total=line_total,
            )
        )
        add_stock_transaction(
            db,
            business_id=business_id,
            product_id=product.id,
            transaction_type=StockTransactionType.PURCHASE,
            quantity=qty,
            created_by=created_by,
            unit_cost=unit_cost,
            reference_type="purchase",
            reference_id=purchase.id,
        )

    db.flush()
    return db.scalars(
        select(Purchase).options(selectinload(Purchase.items)).where(Purchase.id == purchase.id)
    ).one()
