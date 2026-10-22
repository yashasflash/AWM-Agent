from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth.security import get_authenticated_user
from app.services.notification_service import (
    get_unread_count,
    get_user_notifications,
    mark_all_as_read,
    mark_as_read,
)

router = APIRouter()


@router.get("/")
def get_notifications(
    limit: int = Query(default=50, ge=1, le=100),
    current_user: dict = Depends(get_authenticated_user),
) -> dict[str, Any]:
    """Retrieve notifications belonging to the authenticated user."""
    try:
        notifications = get_user_notifications(
            user_id=current_user["user_id"],
            role=current_user["role"],
            email=current_user.get("email"),
            limit=limit,
        )
        unread = get_unread_count(
            user_id=current_user["user_id"],
            role=current_user["role"],
            email=current_user.get("email"),
        )
        return {
            "success": True,
            "count": len(notifications),
            "unread_count": unread,
            "notifications": notifications,
        }
    except Exception as exc:
        print("GET NOTIFICATIONS ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve notifications.",
        ) from exc


@router.patch("/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_authenticated_user),
) -> dict[str, Any]:
    """Mark a specific notification as read."""
    try:
        updated = mark_as_read(
            notification_id=notification_id,
            user_id=current_user["user_id"],
            email=current_user.get("email"),
        )
        if not updated:
            raise HTTPException(
                status_code=404,
                detail="Notification not found or access denied.",
            )
        unread = get_unread_count(
            user_id=current_user["user_id"],
            role=current_user["role"],
            email=current_user.get("email"),
        )
        return {
            "success": True,
            "message": "Notification marked as read.",
            "unread_count": unread,
        }
    except HTTPException:
        raise
    except Exception as exc:
        print("MARK NOTIFICATION READ ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to mark notification as read.",
        ) from exc


@router.patch("/read-all")
def mark_all_notifications_read(
    current_user: dict = Depends(get_authenticated_user),
) -> dict[str, Any]:
    """Mark all unread notifications as read for current user."""
    try:
        count = mark_all_as_read(
            user_id=current_user["user_id"],
            role=current_user["role"],
            email=current_user.get("email"),
        )
        return {
            "success": True,
            "message": f"{count} notifications marked as read.",
            "marked_count": count,
            "unread_count": 0,
        }
    except Exception as exc:
        print("MARK ALL NOTIFICATIONS READ ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to mark all notifications as read.",
        ) from exc
