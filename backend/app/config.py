import os

from dotenv import load_dotenv

# Load environment variables from the backend .env file
load_dotenv()


# =========================================================
# SUPABASE CONFIGURATION
# =========================================================

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()

# Public/anon key used by the normal authenticated client
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip()

# Secret service-role key used only for trusted backend operations
SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "",
).strip()


# =========================================================
# CONFIGURATION VALIDATION
# =========================================================

def validate_config() -> None:
    """Check that the required Supabase configuration exists."""

    missing_variables = []

    if not SUPABASE_URL:
        missing_variables.append("SUPABASE_URL")

    if not SUPABASE_KEY:
        missing_variables.append("SUPABASE_KEY")

    if missing_variables:
        raise RuntimeError(
            "Missing required environment variables: "
            + ", ".join(missing_variables)
            + ". Check your backend .env file."
        )
print("SUPABASE URL loaded:", bool(SUPABASE_URL))
print("SUPABASE KEY loaded:", bool(SUPABASE_KEY))
print(
    "SERVICE ROLE KEY loaded:",
    bool(SUPABASE_SERVICE_ROLE_KEY),
)