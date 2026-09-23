import hashlib
import hmac
import logging
import os
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientError
from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.core.errors import AppError
from app.models.business import BusinessMembership
from app.models.user import User

bearer = HTTPBearer(auto_error=False)
log = logging.getLogger(__name__)
_jwks_client: PyJWKClient | None = None


def _jwks() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(
            f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        )
    return _jwks_client


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return f"pbkdf2${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored or not stored.startswith("pbkdf2$"):
        return False
    _, salt_hex, digest_hex = stored.split("$", 2)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt_hex),
        120_000,
    )
    return hmac.compare_digest(digest.hex(), digest_hex)


def decode_access_token(token: str) -> dict:
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise AppError(401, "INVALID_TOKEN", "Please sign in again.") from exc

    alg = header.get("alg")
    try:
        if alg == "HS256":
            return jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
                leeway=60,
            )
        if alg in {"ES256", "RS256"} and settings.SUPABASE_URL:
            key = _jwks().get_signing_key_from_jwt(token).key
            return jwt.decode(
                token,
                key,
                algorithms=[alg],
                audience="authenticated",
                leeway=60,
                options={"verify_aud": False, "verify_iss": False},
            )
    except (jwt.PyJWTError, PyJWKClientError) as exc:
        log.warning("JWT decode failed alg=%s: %s", alg, exc)
        raise AppError(401, "INVALID_TOKEN", "Please sign in again.") from exc
    raise AppError(401, "INVALID_TOKEN", "Please sign in again.")


def create_access_token(user_id: UUID, email: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "email": email,
        "aud": "authenticated",
        "role": "authenticated",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=12)).timestamp()),
    }
    return jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise AppError(401, "UNAUTHENTICATED", "Please sign in.")
    payload = decode_access_token(creds.credentials)
    raw_sub = payload.get("sub")
    try:
        user_id = UUID(str(raw_sub))
    except (KeyError, TypeError, ValueError) as exc:
        raise AppError(401, "INVALID_TOKEN", "Please sign in again.") from exc
    email = (
        payload.get("email")
        or (payload.get("user_metadata") or {}).get("email")
        or f"{user_id}@unknown.local"
    )
    user = db.get(User, user_id)
    if user is None:
        user = User(id=user_id, email=email)
        db.add(user)
        db.flush()
    elif email and user.email != email:
        user.email = email
        db.flush()
    return user


def get_current_membership(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_business_id: UUID | None = Header(default=None, alias="X-Business-Id"),
) -> BusinessMembership:
    stmt = select(BusinessMembership).where(BusinessMembership.user_id == user.id)
    if x_business_id is not None:
        stmt = stmt.where(BusinessMembership.business_id == x_business_id)
    membership = db.scalars(stmt.order_by(BusinessMembership.created_at)).first()
    if membership is None:
        raise AppError(
            404,
            "NO_BUSINESS",
            "Set up your business to continue.",
        )
    return membership
