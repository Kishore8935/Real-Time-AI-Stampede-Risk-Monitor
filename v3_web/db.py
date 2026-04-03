# =============================================================================
# v3_web/db.py — MongoDB (Motor async) connection layer
#
# Uses Motor so every DB call is async-friendly with FastAPI.
# Indexes are created once at startup in app.py's lifespan handler.
# =============================================================================

import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

_client: AsyncIOMotorClient = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
        _client = AsyncIOMotorClient(uri)
    return _client


def get_db():
    """Return the stampede_monitor database handle."""
    return get_client()["stampede_monitor"]


async def create_indexes():
    """
    Create all required indexes once at startup.
    Safe to call repeatedly — MongoDB ignores duplicate index creation.
    """
    db = get_db()

    # users — unique email constraint
    await db["users"].create_index("email", unique=True)

    # sessions — fast lookup by user, sorted by newest
    await db["sessions"].create_index("session_id", unique=True)
    await db["sessions"].create_index([("user_id", 1), ("uploaded_at", -1)])

    # risk_events — fast lookup per session
    await db["risk_events"].create_index("session_id")
    await db["risk_events"].create_index(
        [("session_id", 1), ("timestamp_sec", 1)]
    )

    # ai_prompt_history — per-user, newest first
    await db["ai_prompt_history"].create_index([("user_id", 1), ("created_at", -1)])

    print("[db] MongoDB indexes verified.")


async def close_client():
    global _client
    if _client is not None:
        _client.close()
        _client = None
