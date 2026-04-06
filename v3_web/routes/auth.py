"""
routes/auth.py — FastAPI auth endpoints.
Mounted in app.py at prefix=/api/auth for API calls
and at / for page serving (login, signup).
"""
import os
from datetime import datetime, timezone

import jwt
from bson import ObjectId
from fastapi import APIRouter, Cookie, Depends, Form, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from database import get_db
from models.user import UserCreate, UserOut
from services.auth_service import (
    create_token,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter()
templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), "..", "templates"))


# ── Page routes ────────────────────────────────────────────────────────────────

@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@router.get("/signup", response_class=HTMLResponse)
async def signup_page(request: Request):
    return templates.TemplateResponse("signup.html", {"request": request})


# ── API auth routes ────────────────────────────────────────────────────────────

@router.post("/api/auth/signup")
async def signup(
    email: str = Form(...),
    password: str = Form(...),
):
    db = get_db()
    existing = await db.users.find_one({"email": email.lower().strip()})
    if existing:
        return JSONResponse({"error": "Email already registered."}, status_code=400)

    user_doc = {
        "email": email.lower().strip(),
        "password_hash": hash_password(password),
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(user_doc)

    token = create_token(str(result.inserted_id))
    response = RedirectResponse(url="/", status_code=302)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        max_age=72 * 3600,
        samesite="lax",
    )
    return response


@router.post("/api/auth/login")
async def login(
    email: str = Form(...),
    password: str = Form(...),
):
    db = get_db()
    user = await db.users.find_one({"email": email.lower().strip()})
    if not user or not verify_password(password, user["password_hash"]):
        return JSONResponse({"error": "Invalid email or password."}, status_code=401)

    token = create_token(str(user["_id"]))
    response = RedirectResponse(url="/", status_code=302)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        max_age=72 * 3600,
        samesite="lax",
    )
    return response


@router.post("/api/auth/logout")
async def logout():
    response = RedirectResponse(url="/login", status_code=302)
    response.delete_cookie("access_token")
    return response


@router.get("/api/auth/me")
async def me(access_token: str | None = Cookie(default=None)):
    """Return the current user's profile for the popup. Called client-side."""
    if not access_token:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)
    try:
        user_id = decode_token(access_token)
    except jwt.PyJWTError:
        return JSONResponse({"error": "Invalid token"}, status_code=401)

    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return JSONResponse({"error": "User not found"}, status_code=404)

    return JSONResponse({"id": str(user["_id"]), "email": user["email"]})


# ── Shared dependency: get_current_user ───────────────────────────────────────

async def get_current_user(access_token: str | None = Cookie(default=None)):
    """
    FastAPI dependency. Returns the user dict or None if unauthenticated.
    Used in app.py to guard / and /dashboard.
    """
    if not access_token:
        return None
    try:
        user_id = decode_token(access_token)
    except jwt.PyJWTError:
        return None

    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    return user
