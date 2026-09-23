from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.db import get_db
from app.core.security import create_access_token
from app.main import app
from app.models import Base
from app.models.stock import StockTransaction
from app.services.inventory import get_current_stock


@pytest.fixture
def engine():
    eng = create_engine(settings.TEST_DATABASE_URL, pool_pre_ping=True)
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture
def db(engine):
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def _get_db():
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise

    app.dependency_overrides[get_db] = _get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


class ApiUser:
    def __init__(self, client: TestClient, email: str | None = None):
        self.client = client
        self.user_id = uuid4()
        self.email = email or f"{self.user_id.hex[:8]}@test.local"
        self.token = create_access_token(self.user_id, self.email)
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def request(self, method: str, path: str, **kwargs):
        headers = {**self.headers, **kwargs.pop("headers", {})}
        return self.client.request(method, path, headers=headers, **kwargs)

    def get(self, path, **kwargs):
        return self.request("GET", path, **kwargs)

    def post(self, path, **kwargs):
        return self.request("POST", path, **kwargs)

    def patch(self, path, **kwargs):
        return self.request("PATCH", path, **kwargs)


@pytest.fixture
def owner(client) -> ApiUser:
    user = ApiUser(client)
    res = user.post("/api/v1/business", json={"name": "Demo Store", "tax_enabled": False})
    assert res.status_code == 201, res.text
    user.business = res.json()
    return user


@pytest.fixture
def other_owner(client) -> ApiUser:
    user = ApiUser(client)
    res = user.post("/api/v1/business", json={"name": "Other Store"})
    assert res.status_code == 201, res.text
    user.business = res.json()
    return user


def create_product(user: ApiUser, name="Rice 5kg", **kwargs):
    payload = {
        "name": name,
        "unit": "bag",
        "selling_price": "420.00",
        "purchase_price": "380.00",
        "minimum_stock": "5",
        **kwargs,
    }
    res = user.post("/api/v1/products", json=payload)
    assert res.status_code == 201, res.text
    return res.json()


def add_opening(user: ApiUser, product_id: str, qty: str = "100"):
    res = user.post(
        "/api/v1/stock/opening",
        json={"product_id": product_id, "quantity": qty},
    )
    assert res.status_code == 201, res.text
    return res.json()


def money(value) -> Decimal:
    return Decimal(str(value))


def test_create_product_and_opening_stock(owner, db):
    product = create_product(owner)
    add_opening(owner, product["id"], "100")
    db.expire_all()
    qty = get_current_stock(db, UUID(owner.business["id"]), UUID(product["id"]))
    assert qty == Decimal("100.000")
    listed = owner.get("/api/v1/products").json()
    assert money(listed[0]["current_stock"]) == Decimal("100")


def test_sale_decreases_stock(owner, db):
    product = create_product(owner)
    add_opening(owner, product["id"], "10")
    res = owner.post(
        "/api/v1/sales",
        json={"items": [{"product_id": product["id"], "quantity": "3"}], "payment_method": "UPI"},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["invoice_number"].startswith("INV-")
    assert money(body["total"]) == Decimal("1260.00")
    db.expire_all()
    assert get_current_stock(db, UUID(owner.business["id"]), UUID(product["id"])) == Decimal("7.000")
    txns = list(
        db.scalars(
            select(StockTransaction).where(StockTransaction.product_id == UUID(product["id"]))
        ).all()
    )
    sale_txns = [t for t in txns if str(t.transaction_type) == "SALE"]
    assert len(sale_txns) == 1
    assert sale_txns[0].quantity == Decimal("-3.000")


def test_purchase_increases_stock(owner, db):
    product = create_product(owner)
    add_opening(owner, product["id"], "10")
    res = owner.post(
        "/api/v1/purchases",
        json={
            "supplier_name": "Local Wholesale",
            "items": [{"product_id": product["id"], "quantity": "20", "unit_cost": "370.00"}],
        },
    )
    assert res.status_code == 201, res.text
    db.expire_all()
    assert get_current_stock(db, UUID(owner.business["id"]), UUID(product["id"])) == Decimal("30.000")


def test_sale_insufficient_stock_is_rejected(owner, db):
    product = create_product(owner)
    add_opening(owner, product["id"], "2")
    res = owner.post(
        "/api/v1/sales",
        json={"items": [{"product_id": product["id"], "quantity": "3"}], "payment_method": "CASH"},
    )
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "INSUFFICIENT_STOCK"
    db.expire_all()
    assert get_current_stock(db, UUID(owner.business["id"]), UUID(product["id"])) == Decimal("2.000")
    sales = owner.get("/api/v1/sales").json()
    assert sales == []


def test_stock_adjustment(owner, db):
    product = create_product(owner)
    add_opening(owner, product["id"], "10")
    res = owner.post(
        "/api/v1/stock/adjustments",
        json={
            "product_id": product["id"],
            "quantity": "-2",
            "transaction_type": "DAMAGE",
            "reason": "Torn bag",
        },
    )
    assert res.status_code == 201, res.text
    db.expire_all()
    assert get_current_stock(db, UUID(owner.business["id"]), UUID(product["id"])) == Decimal("8.000")


def test_daily_closing_and_next_day_opening(owner):
    product = create_product(owner, name="Oil 1L", selling_price="180", purchase_price="150")
    add_opening(owner, product["id"], "10")
    owner.post(
        "/api/v1/sales",
        json={"items": [{"product_id": product["id"], "quantity": "1"}], "payment_method": "CASH"},
    )
    day = date.today().isoformat()
    preview = owner.get("/api/v1/daily-closing", params={"business_date": day})
    assert preview.status_code == 200, preview.text
    first = owner.post("/api/v1/daily-closing", json={"business_date": day})
    assert first.status_code == 201, first.text
    closed = first.json()
    duplicate = owner.post("/api/v1/daily-closing", json={"business_date": day})
    assert duplicate.status_code == 409
    next_day = (date.today() + timedelta(days=1)).isoformat()
    nxt = owner.get("/api/v1/daily-closing", params={"business_date": next_day}).json()
    assert money(nxt["opening_stock_value"]) == money(closed["closing_stock_value"])
    assert nxt["previous_closing_date"] == day


def test_business_isolation(owner, other_owner):
    product = create_product(owner)
    add_opening(owner, product["id"], "5")
    hidden = other_owner.get(f"/api/v1/products/{product['id']}")
    assert hidden.status_code == 404
    listed = other_owner.get("/api/v1/products").json()
    assert listed == []
    sale = other_owner.post(
        "/api/v1/sales",
        json={"items": [{"product_id": product["id"], "quantity": "1"}], "payment_method": "UPI"},
    )
    assert sale.status_code in (400, 404)


def test_sale_uses_backend_prices_not_client_prices(owner):
    product = create_product(owner, selling_price="50.00", purchase_price="20.00")
    add_opening(owner, product["id"], "5")
    res = owner.post(
        "/api/v1/sales",
        json={
            "items": [{"product_id": product["id"], "quantity": "2", "unit_price": "1.00"}],
            "payment_method": "CARD",
        },
    )
    assert res.status_code == 201
    assert money(res.json()["total"]) == Decimal("100.00")
