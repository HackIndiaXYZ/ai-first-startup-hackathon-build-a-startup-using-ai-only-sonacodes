from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import AppError
from app.core.security import create_access_token, get_current_user, hash_password, verify_password
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


class AuthCredentials(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=6, max_length=128)


def _token_payload(user: User) -> dict:
    return {
        "access_token": create_access_token(user.id, user.email),
        "user": {"id": str(user.id), "email": user.email, "full_name": user.full_name},
    }


@router.post("/register")
def register(payload: AuthCredentials, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    existing = db.scalars(select(User).where(func.lower(User.email) == email)).first()
    if existing:
        raise AppError(409, "EMAIL_EXISTS", "An account with that email already exists.")
    user = User(email=email, password_hash=hash_password(payload.password))
    db.add(user)
    db.flush()
    return _token_payload(user)


@router.post("/login")
def login(payload: AuthCredentials, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.scalars(select(User).where(func.lower(User.email) == email)).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.")
    return _token_payload(user)


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"id": str(user.id), "email": user.email, "full_name": user.full_name}
