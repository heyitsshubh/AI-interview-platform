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

    @app.post("/api/debug/resume/{resume_id}/force-process", tags=["Debug"])
    async def force_process_resume(resume_id: str):
        """
        Directly process a resume without going through the BullMQ worker.
        Use this to unblock stuck PENDING resumes.
        """
        import traceback
        from sqlalchemy import select
        from app.core.database import AsyncSessionLocal
        from app.modules.resumes.model import Resume
        from app.modules.resumes.parser import extract_text_from_pdf
        import uuid as uuid_mod

        results = {"resume_id": resume_id, "steps": []}

        try:
            rid = uuid_mod.UUID(resume_id)
        except Exception:
            return {"error": "Invalid resume UUID"}

        async with AsyncSessionLocal() as db:
            try:
                # Step 1: Fetch resume
                result = await db.execute(select(Resume).where(Resume.id == rid))
                resume = result.scalar_one_or_none()
                if not resume:
                    return {"error": f"Resume {resume_id} not found in database"}
                results["steps"].append({"step": "fetch", "status": "ok", "file_path": resume.file_path, "current_status": resume.status})

                # Step 2: Extract text
                try:
                    text = extract_text_from_pdf(resume.file_path)
                    resume.extracted_text = text
                    resume.status = "PROCESSING"
                    await db.flush()
                    await db.commit()
                    results["steps"].append({"step": "extract_text", "status": "ok", "chars": len(text)})
                except Exception as e:
                    results["steps"].append({"step": "extract_text", "status": "error", "error": str(e), "traceback": traceback.format_exc()})
                    resume.status = "FAILED"
                    await db.commit()
                    return results

                # Step 3: Mark DONE (bypassing embeddings)
                resume.embedding_path = "bypassed"
                resume.status = "DONE"
                await db.flush()
                await db.commit()
                results["steps"].append({"step": "mark_done", "status": "ok"})
                results["final_status"] = "DONE"

            except Exception as e:
                results["error"] = str(e)
                results["traceback"] = traceback.format_exc()

        return results

    @app.get("/api/debug/interview/create-test", tags=["Debug"])
    async def debug_create_interview():
        """Debug: tries to create a test interview and returns full error details."""
        import traceback as tb
        import uuid as uuid_mod
        from app.core.database import AsyncSessionLocal
        from app.modules.interviews.model import Interview

        results = {}
        async with AsyncSessionLocal() as db:
            try:
                interview = Interview(
                    user_id=uuid_mod.UUID("00fc6dde-9458-4216-a7d0-6cb435ce4e3c"),
                    resume_id=None,
                    job_title="Debug Test Interview",
                    job_description="debug test",
                    total_questions=3,
                )
                db.add(interview)
                await db.flush()
                await db.commit()
                await db.refresh(interview)
                results["status"] = "success"
                results["interview_id"] = str(interview.id)
            except Exception as e:
                results["status"] = "error"
                results["error"] = str(e)
                results["traceback"] = tb.format_exc()

        return results

    @app.get("/api/debug/interview/{interview_id}/force-start", tags=["Debug"])
    async def debug_force_start_interview(interview_id: str):
        """
        Debug: force-start an interview by generating questions directly.
        Shows full error details if AI generation fails.
        """
        import traceback as tb
        import uuid as uuid_mod
        from sqlalchemy import select
        from app.core.database import AsyncSessionLocal
        from app.modules.interviews.model import Interview, Question

        results = {"interview_id": interview_id, "steps": []}

        try:
            iid = uuid_mod.UUID(interview_id)
        except Exception:
            return {"error": "Invalid interview UUID"}

        async with AsyncSessionLocal() as db:
            try:
                # Step 1: Fetch interview
                res = await db.execute(select(Interview).where(Interview.id == iid))
                interview = res.scalar_one_or_none()
                if not interview:
                    return {"error": f"Interview {interview_id} not found"}

                results["steps"].append({
                    "step": "fetch",
                    "status": "ok",
                    "current_status": interview.status,
                    "job_title": interview.job_title,
                    "resume_id": str(interview.resume_id) if interview.resume_id else None,
                })

                # Step 2: Get resume text
                resume_text = ""
                if interview.resume_id:
                    from app.modules.resumes.model import Resume
                    r = await db.execute(select(Resume).where(Resume.id == interview.resume_id))
                    resume = r.scalar_one_or_none()
                    if resume:
                        resume_text = resume.extracted_text or ""
                results["steps"].append({"step": "resume_text", "status": "ok", "chars": len(resume_text)})

                # Step 3: Generate AI questions
                try:
                    from app.modules.interviews.service import InterviewService
                    svc = InterviewService()
                    
                    # We need a fake user for the service method if it checks permissions
                    # But wait, start_interview needs current_user. Let's just do it directly.
                    
                    from langchain_google_genai import ChatGoogleGenerativeAI
                    from langchain_core.messages import HumanMessage
                    from app.core.config import get_settings
                    import json as json_mod

                    cfg = get_settings()
                    llm = ChatGoogleGenerativeAI(
                        model="gemini-1.5-flash",
                        google_api_key=cfg.GEMINI_API_KEY,
                        temperature=0.7,
                    )

                    total_q = interview.total_questions
                    technical_count = max(1, int(total_q * 0.4))
                    behavioral_count = max(1, int(total_q * 0.35))
                    situational_count = max(1, total_q - technical_count - behavioral_count)

                    resume_context = f"\n\nResume text:\n{resume_text[:3000]}" if resume_text else ""

                    prompt = f"""Generate exactly {total_q} interview questions for a {interview.job_title} position.{resume_context}

        Question distribution:
        - TECHNICAL: {technical_count} questions
        - BEHAVIORAL: {behavioral_count} questions  
        - SITUATIONAL: {situational_count} questions

        Return ONLY a valid JSON array (no markdown, no explanation):
        [
          {{"text": "Question here?", "type": "TECHNICAL", "order_index": 1}},
          ...
        ]"""

                    response = await llm.ainvoke([HumanMessage(content=prompt)])
                    content = response.content.strip()
                    if content.startswith("```"):
                        content = content.split("```")[1]
                        if content.startswith("json"):
                            content = content[4:]
                    content = content.strip()
                    questions = json_mod.loads(content)
                    for i, q in enumerate(questions):
                        q["order_index"] = i + 1
                        
                    results["steps"].append({"step": "ai_generate", "status": "ok", "count": len(questions)})
                except Exception as e:
                    results["steps"].append({"step": "ai_generate", "status": "error", "error": str(e), "traceback": tb.format_exc()})
                    # Use fallback questions
                    jt = interview.job_title
                    questions = [
                        {"text": f"Tell me about your background and experience as a {jt}.", "type": "BEHAVIORAL", "order_index": 1},
                        {"text": f"What are the core technical skills required for a {jt} role?", "type": "TECHNICAL", "order_index": 2},
                        {"text": "Describe a challenging project you worked on and how you solved it.", "type": "BEHAVIORAL", "order_index": 3},
                    ]
                    questions = questions[:interview.total_questions]
                    results["steps"].append({"step": "fallback_questions", "status": "ok", "count": len(questions)})

                # Step 4: Delete old questions and save new ones
                await db.execute(
                    __import__("sqlalchemy").delete(Question).where(Question.interview_id == iid)
                )
                for q in questions:
                    db.add(Question(
                        interview_id=iid,
                        text=q["text"],
                        order_index=q.get("order_index", 1),
                        question_type=q.get("type", "TECHNICAL"),
                    ))
                await db.flush()
                await db.commit()
                results["steps"].append({"step": "save_questions", "status": "ok", "saved": len(questions)})

                # Step 5: Set status ACTIVE
                interview.status = "ACTIVE"
                await db.flush()
                await db.commit()
                results["steps"].append({"step": "set_active", "status": "ok"})
                results["final_status"] = "ACTIVE"
                results["questions_saved"] = len(questions)

            except Exception as e:
                results["error"] = str(e)
                results["traceback"] = tb.format_exc()

        return results

    @app.get("/api/debug/system", tags=["Debug"])
    async def debug_system():
        from app.core.database import engine, create_tables
        from sqlalchemy import text
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
            
        # Redis / BullMQ — removed, not needed anymore
        results["redis"] = {"status": "not_used", "note": "BullMQ removed, processing via FastAPI BackgroundTasks"}
        results["queues"] = {"status": "not_used", "note": "No Redis queues, all jobs run inline"}

        # Test Gemini LLM (chat only, embeddings not used)
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            from langchain_core.messages import HumanMessage
            llm = ChatGoogleGenerativeAI(
                model="gemini-1.5-flash",
                google_api_key=settings.GEMINI_API_KEY,
            )
            await llm.ainvoke([HumanMessage(content="Reply with OK")])
            results["gemini"] = {"status": "success", "model": "gemini-1.5-flash", "has_key": bool(settings.GEMINI_API_KEY)}
        except Exception as e:
            results["gemini"] = {"status": "error", "message": str(e), "has_key": bool(settings.GEMINI_API_KEY)}

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
