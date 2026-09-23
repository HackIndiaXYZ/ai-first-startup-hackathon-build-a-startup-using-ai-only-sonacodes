import enum


class MembershipRole(str, enum.Enum):
    OWNER = "OWNER"
    STAFF = "STAFF"


class StockTransactionType(str, enum.Enum):
    OPENING = "OPENING"
    PURCHASE = "PURCHASE"
    SALE = "SALE"
    RETURN = "RETURN"
    ADJUSTMENT = "ADJUSTMENT"
    DAMAGE = "DAMAGE"
    EXPIRY = "EXPIRY"


class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    UPI = "UPI"
    CARD = "CARD"
    BANK_TRANSFER = "BANK_TRANSFER"
    CREDIT = "CREDIT"


class PaymentStatus(str, enum.Enum):
    PAID = "PAID"
    PARTIAL = "PARTIAL"
    CREDIT = "CREDIT"


class ExpenseCategory(str, enum.Enum):
    RENT = "RENT"
    ELECTRICITY = "ELECTRICITY"
    SALARY = "SALARY"
    TRANSPORT = "TRANSPORT"
    PACKAGING = "PACKAGING"
    MARKETING = "MARKETING"
    OTHER = "OTHER"
