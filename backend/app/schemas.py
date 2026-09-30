from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    ExpenseCategory,
    MembershipRole,
    PaymentMethod,
    PaymentStatus,
    StockTransactionType,
)


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class BusinessCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    business_type: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    logo_url: str | None = None
    currency: str = "INR"
    tax_enabled: bool = False
    tax_rate: Decimal = Decimal("0")
    tax_number: str | None = None
    invoice_prefix: str = "INV"
    invoice_thank_you: str | None = None


class BusinessUpdate(BaseModel):
    name: str | None = None
    business_type: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    logo_url: str | None = None
    currency: str | None = None
    tax_enabled: bool | None = None
    tax_rate: Decimal | None = None
    tax_number: str | None = None
    invoice_prefix: str | None = None
    invoice_thank_you: str | None = None


class BusinessOut(ORMModel):
    id: UUID
    name: str
    business_type: str | None
    address: str | None
    phone: str | None
    email: str | None
    logo_url: str | None
    currency: str
    tax_enabled: bool
    tax_rate: Decimal
    tax_number: str | None
    invoice_prefix: str
    invoice_thank_you: str | None
    role: MembershipRole | None = None


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class CategoryOut(ORMModel):
    id: UUID
    name: str
    created_at: datetime


class CustomFieldCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class CustomFieldOut(ORMModel):
    id: UUID
    name: str
    created_at: datetime


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    sku: str | None = None
    barcode: str | None = None
    category_id: UUID | None = None
    unit: str = "pc"
    selling_price: Decimal
    purchase_price: Decimal = Decimal("0")
    minimum_stock: Decimal = Decimal("0")
    custom_fields: dict = Field(default_factory=dict)
    opening_stock: Decimal | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    sku: str | None = None
    barcode: str | None = None
    category_id: UUID | None = None
    unit: str | None = None
    selling_price: Decimal | None = None
    purchase_price: Decimal | None = None
    minimum_stock: Decimal | None = None
    custom_fields: dict | None = None
    active: bool | None = None


class ProductOut(ORMModel):
    id: UUID
    name: str
    description: str | None
    sku: str | None
    barcode: str | None
    category_id: UUID | None
    unit: str
    selling_price: Decimal
    purchase_price: Decimal
    minimum_stock: Decimal
    active: bool
    custom_fields: dict
    current_stock: Decimal = Decimal("0")
    created_at: datetime
    updated_at: datetime


class StockTxnOut(ORMModel):
    id: UUID
    product_id: UUID
    transaction_type: StockTransactionType
    quantity: Decimal
    unit_cost: Decimal | None
    reference_type: str | None
    reference_id: UUID | None
    reason: str | None
    notes: str | None
    created_at: datetime


class OpeningStockIn(BaseModel):
    product_id: UUID
    quantity: Decimal
    unit_cost: Decimal | None = None
    notes: str | None = None


class AdjustmentIn(BaseModel):
    product_id: UUID
    quantity: Decimal
    transaction_type: StockTransactionType = StockTransactionType.ADJUSTMENT
    reason: str | None = None
    notes: str | None = None


class SaleItemIn(BaseModel):
    product_id: UUID
    quantity: Decimal


class SaleCreate(BaseModel):
    items: list[SaleItemIn]
    discount: Decimal = Decimal("0")
    payment_method: PaymentMethod
    payment_status: PaymentStatus | None = None
    notes: str | None = None


class SaleItemOut(ORMModel):
    id: UUID
    product_id: UUID
    quantity: Decimal
    unit_price: Decimal
    discount: Decimal
    tax: Decimal
    total: Decimal


class SaleOut(ORMModel):
    id: UUID
    invoice_number: str
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    total: Decimal
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    notes: str | None
    created_at: datetime
    items: list[SaleItemOut] = Field(default_factory=list)


class PurchaseItemIn(BaseModel):
    product_id: UUID
    quantity: Decimal
    unit_cost: Decimal


class PurchaseCreate(BaseModel):
    items: list[PurchaseItemIn]
    supplier_name: str | None = None
    invoice_number: str | None = None
    tax: Decimal = Decimal("0")
    payment_status: PaymentStatus = PaymentStatus.PAID
    notes: str | None = None


class PurchaseItemOut(ORMModel):
    id: UUID
    product_id: UUID
    quantity: Decimal
    unit_cost: Decimal
    tax: Decimal
    total: Decimal


class PurchaseOut(ORMModel):
    id: UUID
    supplier_name: str | None
    invoice_number: str | None
    subtotal: Decimal
    tax: Decimal
    total: Decimal
    payment_status: PaymentStatus
    notes: str | None
    created_at: datetime
    items: list[PurchaseItemOut] = Field(default_factory=list)


class ExpenseCreate(BaseModel):
    category: ExpenseCategory
    amount: Decimal
    payment_method: PaymentMethod
    description: str | None = None
    expense_date: date


class ExpenseOut(ORMModel):
    id: UUID
    category: ExpenseCategory
    amount: Decimal
    payment_method: PaymentMethod
    description: str | None
    expense_date: date
    created_at: datetime


class ClosingCreate(BaseModel):
    business_date: date
    notes: str | None = None


class ClosingOut(ORMModel):
    id: UUID
    business_date: date
    opening_stock_value: Decimal
    purchases_value: Decimal
    sales_value: Decimal
    expenses_value: Decimal
    adjustments_value: Decimal
    closing_stock_value: Decimal
    total_units: Decimal
    closed_at: datetime
    notes: str | None
