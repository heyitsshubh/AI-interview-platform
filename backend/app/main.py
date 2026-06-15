"""
FastAPI Application Factory
Assembles all routers, middleware, and lifecycle events.
"""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _configure_logging() -> None:
    logging.basicConfig(
        level=logging.DEBUG if settings.DEBUG else logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def _create_storage_directories() -> None:
    """Create local storage directory structure on startup."""
    dirs = [
        Path(settings.STORAGE_PATH) / "resumes",
        Path(settings.STORAGE_PATH) / "reports",
        Path(settings.STORAGE_PATH) / "audio",
        Path(settings.STORAGE_PATH) / "embeddings",
    ]
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
    logger.info(f"Storage directories verified under: {settings.STORAGE_PATH}")


async def _seed_database() -> None:
    """Seed roles and permissions on startup."""
    from app.core.database import AsyncSessionLocal
    from app.modules.roles.service import RoleService

    try:
        async with AsyncSessionLocal() as db:
            svc = RoleService()
            await svc.seed_roles_and_permissions(db)
            await db.commit()
        logger.info("Database seeded: roles and permissions ready")
    except Exception as exc:
        logger.warning(f"Seeding failed (may be first run or tables missing): {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown."""
    logger.info(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    _configure_logging()
    _create_storage_directories()
    
    from app.core.database import create_tables
    try:
        await create_tables()
    except Exception as e:
        logger.error(f"Error creating tables: {e}")

    await _seed_database()
    logger.info("✅ Application startup complete")

    yield  # App is running

    logger.info("🛑 Shutting down application")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="""
## AI Interview Platform API

A production-grade AI Interview SaaS Platform.

### Features
- 🔐 JWT Authentication with RBAC (CANDIDATE / RECRUITER roles)
- 📄 Resume upload and AI analysis
- 🤖 AI-powered interview question generation (Google Gemini)
- 🎤 Real-time voice interview via WebSocket
- 🕵️ Cheating detection (10 categories)
- 📊 Automated evaluation and PDF report generation
- ⚡ Background job processing via Redis + BullMQ
        """,
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # ── CORS ─────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Global Exception Handler ──────────────────────────────────────────────
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception on {request.method} {request.url}: {exc}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An internal server error occurred. Please try again later."},
        )

    # ── Health Check ──────────────────────────────────────────────────────────
    @app.get("/health", tags=["Health"])
    async def health_check():
        return {
            "status": "healthy",
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
        }

    @app.get("/", tags=["Health"])
    async def root():
        return {
            "message": f"Welcome to {settings.APP_NAME}",
            "docs": "/docs",
            "version": settings.APP_VERSION,
        }

    @app.get("/api/debug/system", tags=["Debug"])
    async def debug_system():
        from app.core.database import engine, create_tables
        from sqlalchemy import text
        from app.queue.producer import get_redis_client
        import traceback
        
        results = {}
        
        # Test DB
        try:
            await create_tables()
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            results["database"] = {"status": "success", "db_url": settings.async_database_url.split("@")[-1]}
        except Exception as e:
            results["database"] = {"status": "error", "message": str(e), "traceback": traceback.format_exc()}
            
        # Test Redis
        try:
            client = get_redis_client()
            client.ping()
            results["redis"] = {
                "status": "success", 
                "host": settings.REDIS_HOST,
                "has_password": bool(settings.REDIS_PASSWORD)
            }
        except Exception as e:
            results["redis"] = {
                "status": "error", 
                "host": settings.REDIS_HOST,
                "has_password": bool(settings.REDIS_PASSWORD),
                "message": str(e), 
                "traceback": traceback.format_exc()
            }
            
        return results

    # ── Routers ───────────────────────────────────────────────────────────────
    # Import all models first to populate SQLAlchemy registry
    from app.modules.users.model import User
    from app.modules.roles.model import Role, Permission, UserRole, RolePermission
    from app.modules.resumes.model import Resume
    from app.modules.interviews.model import Interview, Question, Answer, Report, Job
    from app.modules.cheating.model import CheatingEvent

    from app.modules.auth.routes import router as auth_router
    from app.modules.resumes.routes import router as resume_router
    from app.modules.interviews.routes import router as interview_router
    from app.modules.voice.routes import router as voice_router
    from app.modules.cheating.routes import router as cheating_router
    from app.modules.internal.routes import router as internal_router
    from app.modules.reports.routes import router as report_router

    app.include_router(auth_router)
    app.include_router(resume_router)
    app.include_router(interview_router)
    app.include_router(voice_router)
    app.include_router(cheating_router)
    app.include_router(internal_router)
    app.include_router(report_router)

    # ── User profile routes (inline) ──────────────────────────────────────────
    from fastapi import Depends
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.core.database import get_db
    from app.core.permissions import get_current_user, require_role
    from app.modules.users.service import UserService
    from app.modules.users.schema import UserResponse, UpdateProfileRequest

    user_service = UserService()

    @app.get("/api/users/me", response_model=UserResponse, tags=["Users"])
    async def get_my_profile(
        current_user=Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        """Get current user's profile."""
        return await user_service.get_profile(db, current_user.id)

    @app.patch("/api/users/me", response_model=UserResponse, tags=["Users"])
    async def update_my_profile(
        data: UpdateProfileRequest,
        current_user=Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        """Update current user's profile."""
        return await user_service.update_profile(db, current_user.id, data)

    @app.get("/api/users", response_model=list[UserResponse], tags=["Users"])
    async def list_candidates(
        current_user=Depends(require_role("RECRUITER")),
        db: AsyncSession = Depends(get_db),
    ):
        """List all candidates. RECRUITER only."""
        return await user_service.list_users(db, role_filter="CANDIDATE")

    logger.info(f"Routers mounted. Total routes: {len(app.routes)}")
    return app


app = create_app()
