from fastapi import APIRouter, HTTPException

from app.database import get_supabase_client

router = APIRouter()


@router.get("/")
def health_check():
    """Check whether the backend is running."""

    return {
        "status": "healthy",
        "service": "AWM Agent Backend",
    }


@router.get("/database")
def check_database():
    """Check whether Supabase is reachable."""

    try:
        # Create a client using the Supabase publishable key.
        client = get_supabase_client()

        # Query a small amount of data to test database access.
        response = (
            client.table("waste_reports")
            .select("id")
            .limit(1)
            .execute()
        )

        return {
            "status": "connected",
            "message": "Supabase database is reachable.",
        }

    except Exception as exc:
        # Keep technical details in the local terminal.
        print("SUPABASE HEALTH CHECK ERROR:", repr(exc))

        raise HTTPException(
            status_code=503,
            detail="Supabase database check failed. Check the backend terminal.",
        ) from exc