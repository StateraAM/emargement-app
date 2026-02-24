import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException as FastAPIHTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.middleware import RequestIDMiddleware
from app.core.exceptions import http_exception_handler, validation_exception_handler, generic_exception_handler
from app.core.database import check_db_health
from app.api.v1.auth import router as auth_router
from app.api.v1.courses import router as courses_router
from app.api.v1.attendance import router as attendance_router
from app.api.v1.signatures import router as signatures_router
from app.api.v1.admin import router as admin_router
from app.api.v1.student import router as student_router
from app.api.v1.exports import router as exports_router
from app.api.v1.external import router as external_router
from app.api.v1.ws import router as ws_router
from app.api.v1.analytics import router as analytics_router
from app.tasks.monthly_reports import generate_monthly_reports

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.environ.get("TESTING") != "1":
        scheduler.add_job(generate_monthly_reports, "cron", day=1, hour=8, minute=0)
        scheduler.start()
    yield
    if os.environ.get("TESTING") != "1":
        scheduler.shutdown()


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_exception_handler(FastAPIHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)
app.add_middleware(RequestIDMiddleware)
app.include_router(auth_router, prefix="/api/v1")
app.include_router(courses_router, prefix="/api/v1")
app.include_router(attendance_router, prefix="/api/v1")
app.include_router(signatures_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(student_router, prefix="/api/v1")
app.include_router(exports_router, prefix="/api/v1")
app.include_router(external_router, prefix="/api/v1")
app.include_router(ws_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    db_ok = await check_db_health()
    status = "ok" if db_ok else "degraded"
    return {
        "status": status,
        "database": "connected" if db_ok else "disconnected",
    }
