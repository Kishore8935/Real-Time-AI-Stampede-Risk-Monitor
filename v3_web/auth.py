# =============================================================================
# v3_web/auth.py — JWT & bcrypt authentication helpers
#
# Two responsibilities:
#   1. Password hashing / verification  (passlib + bcrypt)
#   2. JWT token creation / decoding    (python-jose)
#   3. FastAPI dependency: get_current_user — inject into any protected route
# =============================================================================

import os
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

# ── Configuration ─────────────────────────────────────────────────────────────
SECRET_KEY      = os.environ.get("JWT_SECRET_KEY", "CHANGE_ME_in_production_use_a_long_random_string")
ALGORITHM       = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7   # 7 days — good enough for a capstone

# ── Password hashing ──────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain: str) -> str:
    """Hash a plaintext password with bcrypt."""
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    """Return True if plain matches the bcrypt hash."""
    return pwd_context.verify(plain, hashed)

# ── JWT token creation ────────────────────────────────────────────────────────
def create_access_token(data: dict) -> str:
    """
    Create a signed JWT.
    `data` should include at least {"sub": user_email}.
    """
    payload = data.copy()
    expire  = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload.update({"exp": expire})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

# ── FastAPI OAuth2 scheme ─────────────────────────────────────────────────────
# This tells FastAPI to look for a Bearer token in the Authorization header.
# tokenUrl is the login endpoint — used by the auto-generated /docs UI.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# ── get_current_user dependency ───────────────────────────────────────────────
async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    FastAPI dependency. Decode and validate the Bearer JWT.
    Returns the user payload dict: { "sub": email, "user_id": str }
    Raises HTTP 401 if token is missing, expired, or tampered.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        user_id: str = payload.get("user_id")
        if email is None or user_id is None:
            raise credentials_exception
        return {"email": email, "user_id": user_id}
    except JWTError:
        raise credentials_exception
