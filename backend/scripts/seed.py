"""Seed Demo Store data. Requires DATABASE_URL.

Usage:
  cd backend
  SEED_USER_ID=<supabase-user-uuid> python -m scripts.seed
"""

from __future__ import annotations

import os
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.models.business import Business, BusinessCounter, BusinessMembership
from app.models.enums import ExpenseCategory, MembershipRole, PaymentMethod, PaymentStatus
from app.models.expense import Expense
from app.models.product import Product
from app.models.user import User
from app.services.inventory import get_current_stock
from app.services.purchases import create_purchase
from app.services.sales import create_sale


PRODUCTS = [
    {
        "name": "Rice 5kg",
        "unit": "bag",
        "selling_price": Decimal("420.00"),
        "purchase_price": Decimal("380.00"),
        "minimum_stock": Decimal("8"),
        "opening": Decimal("40"),
        "custom_fields": {"brand": "Local Mill", "size": "5kg"},
    },
    {
        "name": "Oil 1L",
        "unit": "bottle",
        "selling_price": Decimal("180.00"),
        "purchase_price": Decimal("155.00"),
        "minimum_stock": Decimal("10"),
        "opening": Decimal("25"),
        "custom_fields": {"brand": "Gold Drop"},
    },
    {
        "name": "Sugar 2kg",
        "unit": "bag",
        "selling_price": Decimal("110.00"),
        "purchase_price": Decimal("95.00"),
        "minimum_stock": Decimal("6"),
        "opening": Decimal("18"),
        "custom_fields": {"size": "2kg"},
    },
    {
        "name": "Milk 1L",
        "unit": "pack",
        "selling_price": Decimal("62.00"),
        "purchase_price": Decimal("54.00"),
        "minimum_stock": Decimal("12"),
        "opening": Decimal("30"),
        "custom_fields": {"brand": "Fresh Dairy"},
    },
    {
        "name": "Bread",
        "unit": "pc",
        "selling_price": Decimal("45.00"),
        "purchase_price": Decimal("32.00"),
        "minimum_stock": Decimal("10"),
        "opening": Decimal("20"),
        "custom_fields": {},
    },
]


def seed(db: Session, user_id: UUID, email: str) -> None:
    user = db.get(User, user_id)
    if user is None:
        user = User(id=user_id, email=email, full_name="Demo Owner")
        db.add(user)
        db.flush()

    business = Business(
        name="Demo Store",
        business_type="Kirana",
        address="12 Market Road, Chennai",
        phone="9876543210",
        email="demo@store.local",
        currency="INR",
        tax_enabled=False,
        invoice_thank_you="Thank you. Visit again.",
    )
    db.add(business)
    db.flush()
    db.add(
        BusinessMembership(business_id=business.id, user_id=user.id, role=MembershipRole.OWNER)
    )
    db.add(BusinessCounter(business_id=business.id, next_invoice_seq=1))
    db.flush()

    products = []
    for spec in PRODUCTS:
        product = Product(
            business_id=business.id,
            name=spec["name"],
            unit=spec["unit"],
            selling_price=spec["selling_price"],
            purchase_price=spec["purchase_price"],
            minimum_stock=spec["minimum_stock"],
            custom_fields=spec["custom_fields"],
        )
        db.add(product)
        db.flush()
        from app.models.enums import StockTransactionType
        from app.services.inventory import add_stock_transaction

        add_stock_transaction(
            db,
            business_id=business.id,
            product_id=product.id,
            transaction_type=StockTransactionType.OPENING,
            quantity=spec["opening"],
            created_by=user.id,
            unit_cost=product.purchase_price,
            reference_type="opening",
        )
        products.append(product)

    rice, oil, sugar, milk, bread = products
    create_sale(
        db,
        business=business,
        created_by=user.id,
        items=[
            {"product_id": rice.id, "quantity": Decimal("2")},
            {"product_id": oil.id, "quantity": Decimal("1")},
        ],
        payment_method=PaymentMethod.UPI,
    )
    create_sale(
        db,
        business=business,
        created_by=user.id,
        items=[
            {"product_id": milk.id, "quantity": Decimal("4")},
            {"product_id": bread.id, "quantity": Decimal("2")},
        ],
        payment_method=PaymentMethod.CASH,
    )
    create_sale(
        db,
        business=business,
        created_by=user.id,
        items=[{"product_id": sugar.id, "quantity": Decimal("1")}],
        payment_method=PaymentMethod.CARD,
    )
    create_purchase(
        db,
        business_id=business.id,
        supplier_name="City Wholesale",
        invoice_number="WH-1042",
        items=[
            {"product_id": rice.id, "quantity": Decimal("10"), "unit_cost": Decimal("375.00")},
            {"product_id": oil.id, "quantity": Decimal("12"), "unit_cost": Decimal("150.00")},
        ],
        created_by=user.id,
    )
    db.add(
        Expense(
            business_id=business.id,
            category=ExpenseCategory.RENT,
            amount=Decimal("8000.00"),
            payment_method=PaymentMethod.BANK_TRANSFER,
            description="Shop rent",
            expense_date=date.today(),
        )
    )
    db.add(
        Expense(
            business_id=business.id,
            category=ExpenseCategory.ELECTRICITY,
            amount=Decimal("1450.00"),
            payment_method=PaymentMethod.UPI,
            description="This month's bill",
            expense_date=date.today() - timedelta(days=1),
        )
    )
    db.commit()
    print("Seeded Demo Store")
    print(f"  user_id: {user.id}")
    print(f"  business_id: {business.id}")
    for product in products:
        qty = get_current_stock(db, business.id, product.id)
        print(f"  {product.name}: {qty} {product.unit}")


if __name__ == "__main__":
    raw = os.environ.get("SEED_USER_ID")
    user_id = UUID(raw) if raw else uuid4()
    email = os.environ.get("SEED_USER_EMAIL", "demo@store.local")
    session = SessionLocal()
    try:
        seed(session, user_id, email)
    finally:
        session.close()
    if not raw:
        print("\nNo SEED_USER_ID set. Created a local user row.")
        print("After you sign up in Supabase, re-run with SEED_USER_ID=<your auth user uuid>")
        print(f"or map this id in development: {user_id}")
