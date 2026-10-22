import os
import sqlite3
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

# Database path in the backend directory
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "awm_notifications.db")

_lock = threading.Lock()


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_notification_db() -> None:
    """Initialize the persistent SQLite table for notifications."""
    with _lock:
        conn = _get_connection()
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS notifications (
                    id TEXT PRIMARY KEY,
                    recipient_id TEXT NOT NULL,
                    recipient_role TEXT NOT NULL,
                    type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    message TEXT NOT NULL,
                    report_id TEXT,
                    report_number INTEGER,
                    task_id TEXT,
                    created_at TEXT NOT NULL,
                    is_read INTEGER DEFAULT 0,
                    read_at TEXT
                );
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_notifications_recipient 
                ON notifications (recipient_id, recipient_role, is_read);
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_notifications_report 
                ON notifications (report_id, type);
                """
            )
            conn.commit()
        finally:
            conn.close()


# Initialize table on import
init_notification_db()


def create_notification(
    recipient_id: str,
    recipient_role: str,
    notification_type: str,
    title: str,
    message: str,
    report_id: Optional[str] = None,
    report_number: Optional[int] = None,
    task_id: Optional[str] = None,
    prevent_duplicate_window_seconds: int = 60,
) -> Dict[str, Any]:
    """
    Persistently create a notification.
    Prevents duplicate notifications for the same recipient, type, and report
    within a short window (e.g. from retries).
    """
    clean_recipient = str(recipient_id).strip().lower()
    clean_role = str(recipient_role).strip().lower()
    clean_type = str(notification_type).strip().upper()
    now_iso = datetime.now(timezone.utc).isoformat()

    with _lock:
        conn = _get_connection()
        try:
            # Check for existing duplicate if report_id provided
            if report_id:
                cur = conn.execute(
                    """
                    SELECT id FROM notifications
                    WHERE recipient_id = ? AND type = ? AND report_id = ?
                    ORDER BY created_at DESC LIMIT 1;
                    """,
                    (clean_recipient, clean_type, str(report_id)),
                )
                existing = cur.fetchone()
                if existing:
                    # Return existing notification to prevent duplicate spam
                    cur2 = conn.execute("SELECT * FROM notifications WHERE id = ?", (existing["id"],))
                    row = cur2.fetchone()
                    return dict(row)

            notif_id = str(uuid4())
            conn.execute(
                """
                INSERT INTO notifications (
                    id, recipient_id, recipient_role, type, title, message,
                    report_id, report_number, task_id, created_at, is_read, read_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL);
                """,
                (
                    notif_id,
                    clean_recipient,
                    clean_role,
                    clean_type,
                    title.strip(),
                    message.strip(),
                    str(report_id) if report_id else None,
                    report_number,
                    str(task_id) if task_id else None,
                    now_iso,
                ),
            )
            conn.commit()

            cur = conn.execute("SELECT * FROM notifications WHERE id = ?", (notif_id,))
            created_row = cur.fetchone()
            return dict(created_row)
        finally:
            conn.close()


def get_user_notifications(
    user_id: str,
    role: str,
    email: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """Retrieve all notifications matching the authenticated user."""
    clean_uid = str(user_id).strip().lower()
    clean_role = str(role).strip().lower()
    clean_email = str(email).strip().lower() if email else ""

    with _lock:
        conn = _get_connection()
        try:
            if clean_role == "manager":
                # Managers see notifications addressed to their user_id, email, or role "manager"
                cur = conn.execute(
                    """
                    SELECT * FROM notifications
                    WHERE recipient_id = ? OR recipient_id = ? OR recipient_role = 'manager'
                    ORDER BY created_at DESC LIMIT ?;
                    """,
                    (clean_uid, clean_email, limit),
                )
            elif clean_role == "municipal_staff":
                # Staff see notifications addressed to their user_id, email, or role "municipal_staff"
                cur = conn.execute(
                    """
                    SELECT * FROM notifications
                    WHERE recipient_id = ? OR recipient_id = ? OR recipient_role = 'municipal_staff'
                    ORDER BY created_at DESC LIMIT ?;
                    """,
                    (clean_uid, clean_email, limit),
                )
            else:
                # Citizens see notifications specifically addressed to their user_id or email
                cur = conn.execute(
                    """
                    SELECT * FROM notifications
                    WHERE recipient_id = ? OR recipient_id = ?
                    ORDER BY created_at DESC LIMIT ?;
                    """,
                    (clean_uid, clean_email, limit),
                )
            rows = cur.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()


def mark_as_read(notification_id: str, user_id: str, email: Optional[str] = None) -> bool:
    """Mark a specific notification as read."""
    now_iso = datetime.now(timezone.utc).isoformat()
    clean_uid = str(user_id).strip().lower()
    clean_email = str(email).strip().lower() if email else ""

    with _lock:
        conn = _get_connection()
        try:
            cur = conn.execute(
                """
                UPDATE notifications
                SET is_read = 1, read_at = ?
                WHERE id = ? AND (recipient_id = ? OR recipient_id = ? OR recipient_role IN ('manager', 'municipal_staff'));
                """,
                (now_iso, notification_id, clean_uid, clean_email),
            )
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()


def mark_all_as_read(user_id: str, role: str, email: Optional[str] = None) -> int:
    """Mark all unread notifications as read for the user."""
    now_iso = datetime.now(timezone.utc).isoformat()
    clean_uid = str(user_id).strip().lower()
    clean_role = str(role).strip().lower()
    clean_email = str(email).strip().lower() if email else ""

    with _lock:
        conn = _get_connection()
        try:
            if clean_role == "manager":
                cur = conn.execute(
                    """
                    UPDATE notifications
                    SET is_read = 1, read_at = ?
                    WHERE is_read = 0 AND (recipient_id = ? OR recipient_id = ? OR recipient_role = 'manager');
                    """,
                    (now_iso, clean_uid, clean_email),
                )
            elif clean_role == "municipal_staff":
                cur = conn.execute(
                    """
                    UPDATE notifications
                    SET is_read = 1, read_at = ?
                    WHERE is_read = 0 AND (recipient_id = ? OR recipient_id = ? OR recipient_role = 'municipal_staff');
                    """,
                    (now_iso, clean_uid, clean_email),
                )
            else:
                cur = conn.execute(
                    """
                    UPDATE notifications
                    SET is_read = 1, read_at = ?
                    WHERE is_read = 0 AND (recipient_id = ? OR recipient_id = ?);
                    """,
                    (now_iso, clean_uid, clean_email),
                )
            conn.commit()
            return cur.rowcount
        finally:
            conn.close()


def get_unread_count(user_id: str, role: str, email: Optional[str] = None) -> int:
    """Get the unread notification count for the user."""
    clean_uid = str(user_id).strip().lower()
    clean_role = str(role).strip().lower()
    clean_email = str(email).strip().lower() if email else ""

    with _lock:
        conn = _get_connection()
        try:
            if clean_role == "manager":
                cur = conn.execute(
                    """
                    SELECT COUNT(*) as cnt FROM notifications
                    WHERE is_read = 0 AND (recipient_id = ? OR recipient_id = ? OR recipient_role = 'manager');
                    """,
                    (clean_uid, clean_email),
                )
            elif clean_role == "municipal_staff":
                cur = conn.execute(
                    """
                    SELECT COUNT(*) as cnt FROM notifications
                    WHERE is_read = 0 AND (recipient_id = ? OR recipient_id = ? OR recipient_role = 'municipal_staff');
                    """,
                    (clean_uid, clean_email),
                )
            else:
                cur = conn.execute(
                    """
                    SELECT COUNT(*) as cnt FROM notifications
                    WHERE is_read = 0 AND (recipient_id = ? OR recipient_id = ?);
                    """,
                    (clean_uid, clean_email),
                )
            row = cur.fetchone()
            return row["cnt"] if row else 0
        finally:
            conn.close()


class _NotificationServiceCompat:
    """
    Compatibility wrapper so the test suite can use:
        from app.services.notification_service import notification_service
        notification_service.get_notifications_for_user(user_id, email, role)
    """

    def create_notification(self, **kwargs):
        return create_notification(**kwargs)

    def get_notifications_for_user(
        self,
        user_id: str,
        email: Optional[str] = None,
        role: str = "citizen",
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Retrieve notifications for a user (test-suite compatible signature)."""
        return get_user_notifications(user_id=user_id, role=role, email=email, limit=limit)

    def get_user_notifications(
        self,
        user_id: str,
        role: str,
        email: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        return get_user_notifications(user_id=user_id, role=role, email=email, limit=limit)

    def mark_as_read(self, notification_id: str, user_id: str, email: Optional[str] = None) -> bool:
        return mark_as_read(notification_id=notification_id, user_id=user_id, email=email)

    def mark_all_as_read(self, user_id: str, role: str, email: Optional[str] = None) -> int:
        return mark_all_as_read(user_id=user_id, role=role, email=email)

    def get_unread_count(self, user_id: str, role: str, email: Optional[str] = None) -> int:
        return get_unread_count(user_id=user_id, role=role, email=email)


# Singleton compatibility object — importable as ``notification_service``
notification_service = _NotificationServiceCompat()
