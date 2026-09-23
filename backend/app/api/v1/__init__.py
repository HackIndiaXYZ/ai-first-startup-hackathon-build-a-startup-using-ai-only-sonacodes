from fastapi import APIRouter

from app.api.v1 import (
    auth,
    business,
    categories,
    closing,
    custom_fields,
    dashboard,
    expenses,
    products,
    purchases,
    sales,
    stock,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(business.router)
api_router.include_router(categories.router)
api_router.include_router(custom_fields.router)
api_router.include_router(products.router)
api_router.include_router(stock.router)
api_router.include_router(sales.router)
api_router.include_router(purchases.router)
api_router.include_router(expenses.router)
api_router.include_router(closing.router)
api_router.include_router(dashboard.router)
