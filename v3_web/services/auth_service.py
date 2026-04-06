"""
services/auth_service.py — Password hashing and JWT business logic.
No HTTP / FastAPI knowledge here — pure functions only.
"""
import os
from datetime import datetime, timedelta, timezone

import jwt

JWT_SECRET       = os.getenv("JWT_SECRET", "change_this_secret")
JWT_ALGORITHM    = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", 72))

import bcrypt as _bcrypt

# ── Password helpers ───────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode(), _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


# ── JWT helpers ────────────────────────────────────────────────────────────────

def create_token(user_id: str) -> str:
    """Create a signed JWT that expires in JWT_EXPIRE_HOURS hours."""
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> str:
    """Decode a JWT and return the user_id ('sub'). Raises jwt.PyJWTError on failure."""
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    return payload["sub"]
