from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import AppError
from app.models.business import Business, BusinessCounter
from app.models.enums import PaymentMethod, PaymentStatus, StockTransactionType
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.services.inventory import add_stock_transaction, quantize_money, quantize_qty


def _next_invoice_number(db: Session, business: Business) -> str:
    counter = db.scalars(
        select(BusinessCounter)
        .where(BusinessCounter.business_id == business.id)
        .with_for_update()
    ).first()
    if counter is None:
        counter = BusinessCounter(business_id=business.id, next_invoice_seq=1)
        db.add(counter)
        db.flush()
    seq = counter.next_invoice_seq
    counter.next_invoice_seq = seq + 1
    db.flush()
    return f"{business.invoice_prefix}-{seq:04d}"


def create_sale(
    db: Session,
    *,
    business: Business,
    created_by: UUID,
    items: list[dict],
    discount: Decimal = Decimal("0"),
    payment_method: PaymentMethod,
    payment_status: PaymentStatus | None = None,
    notes: str | None = None,
) -> Sale:
    if not items:
        raise AppError(400, "EMPTY_CART", "Add at least one product to the bill.")

    discount = quantize_money(discount)
    if discount < 0:
        raise AppError(400, "INVALID_DISCOUNT", "Discount cannot be negative.")

    # Merge duplicate product lines
    merged: dict[UUID, Decimal] = {}
    for raw in items:
        product_id = raw["product_id"] if isinstance(raw["product_id"], UUID) else UUID(str(raw["product_id"]))
        qty = quantize_qty(Decimal(str(raw["quantity"])))
        if qty <= 0:
            raise AppError(400, "INVALID_QUANTITY", "Quantity must be greater than zero.")
        merged[product_id] = merged.get(product_id, Decimal("0")) + qty

    products = {
        p.id: p
        for p in db.scalars(
            select(Product).where(
                Product.business_id == business.id,
                Product.id.in_(list(merged.keys())),
            )
        ).all()
    }
    missing = set(merged) - set(products)
    if missing:
        raise AppError(400, "PRODUCT_NOT_FOUND", "One or more products were not found.")

    subtotal = Decimal("0")
    line_rows: list[tuple[Product, Decimal, Decimal, Decimal]] = []
    for product_id, qty in merged.items():
        product = products[product_id]
        if not product.active:
            raise AppError(400, "PRODUCT_ARCHIVED", f"{product.name} is archived.")
        unit_price = quantize_money(product.selling_price)
        line_total = quantize_money(unit_price * qty)
        subtotal += line_total
        line_rows.append((product, qty, unit_price, line_total))

    subtotal = quantize_money(subtotal)
    if discount > subtotal:
        raise AppError(400, "INVALID_DISCOUNT", "Discount cannot be more than the bill total.")

    taxable = subtotal - discount
    tax = Decimal("0")
    if business.tax_enabled and Decimal(business.tax_rate) > 0:
        tax = quantize_money(taxable * Decimal(business.tax_rate) / Decimal("100"))
    total = quantize_money(taxable + tax)

    if payment_status is None:
        payment_status = (
            PaymentStatus.CREDIT if payment_method == PaymentMethod.CREDIT else PaymentStatus.PAID
        )

    invoice_number = _next_invoice_number(db, business)
    sale = Sale(
        business_id=business.id,
        invoice_number=invoice_number,
        subtotal=subtotal,
        discount=discount,
        tax=tax,
        total=total,
        payment_method=payment_method,
        payment_status=payment_status,
        notes=notes,
        created_by=created_by,
    )
    db.add(sale)
    db.flush()

    tax_share_left = tax
    for index, (product, qty, unit_price, line_total) in enumerate(line_rows):
        if subtotal > 0:
            line_tax = quantize_money(tax * line_total / subtotal)
        else:
            line_tax = Decimal("0")
        if index == len(line_rows) - 1:
            line_tax = tax_share_left
        else:
            tax_share_left -= line_tax
        item = SaleItem(
            sale_id=sale.id,
            product_id=product.id,
            quantity=qty,
            unit_price=unit_price,
            discount=Decimal("0"),
            tax=line_tax,
            total=quantize_money(line_total + line_tax),
        )
        db.add(item)
        add_stock_transaction(
            db,
            business_id=business.id,
            product_id=product.id,
            transaction_type=StockTransactionType.SALE,
            quantity=qty,
            created_by=created_by,
            unit_cost=product.purchase_price,
            reference_type="sale",
            reference_id=sale.id,
        )

    db.flush()
    db.refresh(sale)
    sale = db.scalars(
        select(Sale).options(selectinload(Sale.items)).where(Sale.id == sale.id)
    ).one()
    return sale
