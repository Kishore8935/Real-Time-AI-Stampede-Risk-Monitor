"""
models/user.py — Pydantic schemas for the User entity.
"""
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    """Used for both signup and login form data."""
    email: EmailStr
    password: str


class UserOut(BaseModel):
    """Safe to return to the frontend — no password hash."""
    id: str
    email: str
