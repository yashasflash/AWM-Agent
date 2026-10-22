from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.auth import router as auth_router

from app.api.routes.health import router as health_router
from app.api.routes.reports import router as reports_router
from app.api.routes.notifications import router as notifications_router

app = FastAPI(
    title="AWM Agent API",
    description="Autonomous AI Waste Management Agent",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "project": "AWM Agent",
        "message": "Waste Management Backend is running!",
        "status": "success",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "AWM Agent Backend",
    }


app.include_router(
    health_router,
    prefix="/health",
    tags=["Health"],
)

app.include_router(
    reports_router,
    prefix="/api/v1/reports",
    tags=["Waste Reports"],
)
app.include_router(
    auth_router,
    prefix="/api/v1/auth",
    tags=["Authentication"],
)
app.include_router(
    notifications_router,
    prefix="/api/v1/notifications",
    tags=["Notifications"],
)