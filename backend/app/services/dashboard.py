from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.expense import Expense
from app.models.product import Product
from app.models.purchase import Purchase
from app.models.sale import Sale, SaleItem
from app.models.stock import StockTransaction
from app.services.closing import day_bounds
from app.services.inventory import (
    get_all_current_stock,
    get_low_stock_products,
    get_out_of_stock_products,
    get_stock_value,
    quantize_money,
    quantize_qty,
)


def dashboard_summary(db: Session, business_id: UUID, business_date: date) -> dict:
    start, end = day_bounds(business_date)
    sales_total = db.scalar(
        select(func.coalesce(func.sum(Sale.total), 0)).where(
            Sale.business_id == business_id,
            Sale.created_at >= start,
            Sale.created_at <= end,
        )
    )
    bills_count = db.scalar(
        select(func.count(Sale.id)).where(
            Sale.business_id == business_id,
            Sale.created_at >= start,
            Sale.created_at <= end,
        )
    )
    purchases_total = db.scalar(
        select(func.coalesce(func.sum(Purchase.total), 0)).where(
            Purchase.business_id == business_id,
            Purchase.created_at >= start,
            Purchase.created_at <= end,
        )
    )
    expenses_total = db.scalar(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.business_id == business_id,
            Expense.expense_date == business_date,
        )
    )

    top_rows = db.execute(
        select(
            Product.id,
            Product.name,
            func.sum(SaleItem.quantity).label("qty"),
            func.sum(SaleItem.total).label("amount"),
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .join(Product, Product.id == SaleItem.product_id)
        .where(
            Sale.business_id == business_id,
            Sale.created_at >= start,
            Sale.created_at <= end,
        )
        .group_by(Product.id, Product.name)
        .order_by(desc("qty"))
        .limit(5)
    ).all()

    recent = db.scalars(
        select(StockTransaction)
        .where(StockTransaction.business_id == business_id)
        .order_by(StockTransaction.created_at.desc())
        .limit(10)
    ).all()
    product_ids = {t.product_id for t in recent}
    names = {}
    if product_ids:
        names = {
            p.id: p.name
            for p in db.scalars(select(Product).where(Product.id.in_(product_ids))).all()
        }

    return {
        "business_date": business_date,
        "sales_total": quantize_money(Decimal(sales_total or 0)),
        "bills_count": int(bills_count or 0),
        "purchases_total": quantize_money(Decimal(purchases_total or 0)),
        "expenses_total": quantize_money(Decimal(expenses_total or 0)),
        "low_stock_count": len(get_low_stock_products(db, business_id)),
        "out_of_stock_count": len(get_out_of_stock_products(db, business_id)),
        "stock_value": get_stock_value(db, business_id),
        "top_products": [
            {
                "product_id": row.id,
                "name": row.name,
                "quantity": quantize_qty(Decimal(row.qty)),
                "amount": quantize_money(Decimal(row.amount or 0)),
            }
            for row in top_rows
        ],
        "recent_transactions": [
            {
                "id": t.id,
                "product_id": t.product_id,
                "product_name": names.get(t.product_id, "Product"),
                "transaction_type": t.transaction_type,
                "quantity": t.quantity,
                "created_at": t.created_at,
            }
            for t in recent
        ],
        "current_stock_count": len(get_all_current_stock(db, business_id)),
    }
