from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import AppError
from app.core.security import get_current_membership
from app.models.business import BusinessMembership
from app.models.product import Category
from app.schemas import CategoryCreate, CategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    return list(
        db.scalars(
            select(Category)
            .where(Category.business_id == membership.business_id)
            .order_by(Category.name)
        ).all()
    )


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(
    payload: CategoryCreate,
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    existing = db.scalars(
        select(Category).where(
            Category.business_id == membership.business_id,
            Category.name == payload.name.strip(),
        )
    ).first()
    if existing:
        raise AppError(409, "CATEGORY_EXISTS", "That category already exists.")
    category = Category(business_id=membership.business_id, name=payload.name.strip())
    db.add(category)
    db.flush()
    return category


@router.delete("/{category_id}", status_code=204)
def delete_category(
    category_id: str,
    membership: BusinessMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    category = db.scalars(
        select(Category).where(
            Category.id == category_id,
            Category.business_id == membership.business_id,
        )
    ).first()
    if category is None:
        raise AppError(404, "CATEGORY_NOT_FOUND", "Category not found.")
    db.delete(category)
    db.flush()
