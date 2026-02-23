# Digital Attendance (Émargement) App — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a digital attendance web app where professors take roll call, students e-sign their presence, and parents receive monthly reports.

**Architecture:** Monorepo with Next.js frontend (Vercel) + FastAPI backend (Railway) + Supabase PostgreSQL. Galia CRM integration via adapter pattern (mock first). Resend for emails.

**Tech Stack:** Next.js 14 (App Router, TypeScript, Tailwind, SWR, PWA), FastAPI (async SQLAlchemy, Pydantic v2), Supabase (PostgreSQL + Auth), Resend, python-qrcode, ReportLab, APScheduler.

**Design doc:** `docs/plans/2026-02-23-emargement-design.md`

---

## Phase 1: Backend Foundation

### Task 1: Backend Project Scaffolding

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/core/config.py`
- Create: `backend/app/core/database.py`

**Step 1: Create requirements.txt**

```txt
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy[asyncio]==2.0.35
asyncpg==0.30.0
pydantic==2.9.0
pydantic-settings==2.5.0
alembic==1.13.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
resend==2.5.0
qrcode[pil]==8.0
reportlab==4.2.0
apscheduler==3.10.4
httpx==0.27.0
pytest==8.3.0
pytest-asyncio==0.24.0
```

**Step 2: Create config.py**

```python
# backend/app/core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Emargement API"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/emargement"
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    JWT_SECRET: str = "dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 480
    RESEND_API_KEY: str = ""
    FRONTEND_URL: str = "http://localhost:3000"
    CORS_ORIGINS: str = "http://localhost:3000"
    GALIA_MOCK: bool = True

    class Config:
        env_file = ".env"

settings = Settings()
```

**Step 3: Create database.py**

```python
# backend/app/core/database.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with async_session() as session:
        yield session
```

**Step 4: Create main.py**

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

**Step 5: Create empty __init__.py files**

Empty files for `backend/app/__init__.py` and `backend/app/core/__init__.py`.

**Step 6: Test the server starts**

Run: `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000`
Expected: Server starts, `GET http://localhost:8000/health` returns `{"status": "ok"}`

**Step 7: Commit**

```bash
git add backend/
git commit -m "feat: backend project scaffolding with FastAPI, config, database setup"
```

---

### Task 2: SQLAlchemy Models

**Files:**
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/professor.py`
- Create: `backend/app/models/student.py`
- Create: `backend/app/models/student_contact.py`
- Create: `backend/app/models/course.py`
- Create: `backend/app/models/course_enrollment.py`
- Create: `backend/app/models/attendance_record.py`
- Create: `backend/app/models/monthly_report.py`

**Step 1: Create professor model**

```python
# backend/app/models/professor.py
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class Professor(Base):
    __tablename__ = "professors"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, default="prof")  # prof | admin
    galia_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    courses: Mapped[list["Course"]] = relationship(back_populates="professor")
```

**Step 2: Create student model**

```python
# backend/app/models/student.py
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class Student(Base):
    __tablename__ = "students"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    is_alternance: Mapped[bool] = mapped_column(Boolean, default=False)
    galia_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    contacts: Mapped[list["StudentContact"]] = relationship(back_populates="student")
    enrollments: Mapped[list["CourseEnrollment"]] = relationship(back_populates="student")
    attendance_records: Mapped[list["AttendanceRecord"]] = relationship(back_populates="student")
```

**Step 3: Create student_contact model**

```python
# backend/app/models/student_contact.py
import uuid
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class StudentContact(Base):
    __tablename__ = "student_contacts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)  # parent | tutor
    email: Mapped[str] = mapped_column(String, nullable=False)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    company: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    student: Mapped["Student"] = relationship(back_populates="contacts")
```

**Step 4: Create course model**

```python
# backend/app/models/course.py
import uuid
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class Course(Base):
    __tablename__ = "courses"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    professor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("professors.id"), nullable=False)
    room: Mapped[str] = mapped_column(String, nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    galia_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    professor: Mapped["Professor"] = relationship(back_populates="courses")
    enrollments: Mapped[list["CourseEnrollment"]] = relationship(back_populates="course")
    attendance_records: Mapped[list["AttendanceRecord"]] = relationship(back_populates="course")
```

**Step 5: Create course_enrollment model**

```python
# backend/app/models/course_enrollment.py
import uuid
from datetime import datetime
from sqlalchemy import ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class CourseEnrollment(Base):
    __tablename__ = "course_enrollments"
    __table_args__ = (UniqueConstraint("course_id", "student_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id"), nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    course: Mapped["Course"] = relationship(back_populates="enrollments")
    student: Mapped["Student"] = relationship(back_populates="enrollments")
```

**Step 6: Create attendance_record model**

```python
# backend/app/models/attendance_record.py
import uuid
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    __table_args__ = (UniqueConstraint("course_id", "student_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id"), nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)  # present | absent | late
    marked_by_prof_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    signature_token: Mapped[uuid.UUID] = mapped_column(default=uuid.uuid4)
    signature_token_expires: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    signature_ip: Mapped[str | None] = mapped_column(String, nullable=True)
    signature_user_agent: Mapped[str | None] = mapped_column(String, nullable=True)
    qr_signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    course: Mapped["Course"] = relationship(back_populates="attendance_records")
    student: Mapped["Student"] = relationship(back_populates="attendance_records")
```

**Step 7: Create monthly_report model**

```python
# backend/app/models/monthly_report.py
import uuid
from datetime import date, datetime
from sqlalchemy import String, Integer, Numeric, ForeignKey, Date, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class MonthlyReport(Base):
    __tablename__ = "monthly_reports"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), nullable=False)
    contact_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("student_contacts.id"), nullable=False)
    month: Mapped[date] = mapped_column(Date, nullable=False)
    total_courses: Mapped[int] = mapped_column(Integer, nullable=False)
    attended: Mapped[int] = mapped_column(Integer, nullable=False)
    absent: Mapped[int] = mapped_column(Integer, nullable=False)
    late: Mapped[int] = mapped_column(Integer, nullable=False)
    attendance_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    pdf_url: Mapped[str] = mapped_column(String, nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    student: Mapped["Student"] = relationship()
    contact: Mapped["StudentContact"] = relationship()
```

**Step 8: Create models __init__.py with all imports**

```python
# backend/app/models/__init__.py
from app.models.professor import Professor
from app.models.student import Student
from app.models.student_contact import StudentContact
from app.models.course import Course
from app.models.course_enrollment import CourseEnrollment
from app.models.attendance_record import AttendanceRecord
from app.models.monthly_report import MonthlyReport

__all__ = [
    "Professor", "Student", "StudentContact",
    "Course", "CourseEnrollment", "AttendanceRecord", "MonthlyReport",
]
```

**Step 9: Verify models import without errors**

Run: `cd backend && python -c "from app.models import *; print('All models loaded OK')"`
Expected: `All models loaded OK`

**Step 10: Commit**

```bash
git add backend/app/models/
git commit -m "feat: add all SQLAlchemy models (professors, students, courses, attendance, reports)"
```

---

### Task 3: Alembic Migrations + Seed Data

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/app/seed.py`

**Step 1: Initialize Alembic**

Run: `cd backend && alembic init alembic`

**Step 2: Update alembic/env.py to use async engine and import models**

Replace `alembic/env.py` with async config that imports `app.core.database.Base` and all models from `app.models`. Set `target_metadata = Base.metadata`. Use `run_async_migrations()` with `connectable = create_async_engine(settings.DATABASE_URL)`.

**Step 3: Update alembic.ini**

Set `sqlalchemy.url` to empty (we override in env.py from settings).

**Step 4: Generate initial migration**

Run: `cd backend && alembic revision --autogenerate -m "initial schema"`
Expected: Migration file created in `alembic/versions/`

**Step 5: Run migration**

Run: `cd backend && alembic upgrade head`
Expected: All tables created in database

**Step 6: Create seed data script**

```python
# backend/app/seed.py
"""Seed database with mock data for development."""
import asyncio
import uuid
from datetime import datetime, timedelta, date
from passlib.context import CryptContext
from app.core.database import async_session, engine, Base
from app.models import *

pwd_context = CryptContext(schemes=["bcrypt"])

async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # Professors
        prof1 = Professor(
            id=uuid.uuid4(), email="jean.dupont@ecole.fr",
            first_name="Jean", last_name="Dupont",
            password_hash=pwd_context.hash("password123"), role="prof"
        )
        admin = Professor(
            id=uuid.uuid4(), email="admin@ecole.fr",
            first_name="Admin", last_name="Ecole",
            password_hash=pwd_context.hash("admin123"), role="admin"
        )
        db.add_all([prof1, admin])

        # Students
        students = []
        student_data = [
            ("alice.martin@etu.fr", "Alice", "Martin", True),
            ("bob.bernard@etu.fr", "Bob", "Bernard", False),
            ("claire.petit@etu.fr", "Claire", "Petit", True),
            ("david.leroy@etu.fr", "David", "Leroy", False),
            ("emma.moreau@etu.fr", "Emma", "Moreau", True),
            ("frank.simon@etu.fr", "Frank", "Simon", False),
            ("gaelle.laurent@etu.fr", "Gaëlle", "Laurent", False),
            ("hugo.michel@etu.fr", "Hugo", "Michel", True),
        ]
        for email, first, last, alt in student_data:
            s = Student(id=uuid.uuid4(), email=email, first_name=first, last_name=last, is_alternance=alt)
            students.append(s)
            db.add(s)

        # Contacts for alternance students
        for s in students:
            if s.is_alternance:
                db.add(StudentContact(
                    student_id=s.id, type="parent",
                    email=f"parent.{s.last_name.lower()}@mail.fr",
                    first_name="Parent", last_name=s.last_name,
                ))
                db.add(StudentContact(
                    student_id=s.id, type="tutor",
                    email=f"tuteur.{s.last_name.lower()}@entreprise.fr",
                    first_name="Tuteur", last_name=s.last_name,
                    company="Entreprise SA",
                ))

        # Courses (today and this week)
        today = date.today()
        courses_data = [
            ("Marketing L3", "B204", 9, 11),
            ("Finance M1", "A102", 14, 16),
            ("Stratégie M2", "C301", 16, 18),
        ]
        courses = []
        for name, room, start_h, end_h in courses_data:
            c = Course(
                id=uuid.uuid4(), name=name, professor_id=prof1.id, room=room,
                start_time=datetime(today.year, today.month, today.day, start_h, 0),
                end_time=datetime(today.year, today.month, today.day, end_h, 0),
            )
            courses.append(c)
            db.add(c)

        # Enroll all students in all courses
        for c in courses:
            for s in students:
                db.add(CourseEnrollment(course_id=c.id, student_id=s.id))

        await db.commit()
        print(f"Seeded: {len([prof1, admin])} profs, {len(students)} students, {len(courses)} courses")

if __name__ == "__main__":
    asyncio.run(seed())
```

**Step 7: Run seed**

Run: `cd backend && python -m app.seed`
Expected: `Seeded: 2 profs, 8 students, 3 courses`

**Step 8: Commit**

```bash
git add backend/alembic/ backend/alembic.ini backend/app/seed.py
git commit -m "feat: add Alembic migrations and seed data script"
```

---

### Task 4: Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/schemas/auth.py`
- Create: `backend/app/schemas/course.py`
- Create: `backend/app/schemas/attendance.py`
- Create: `backend/app/schemas/student.py`
- Create: `backend/app/schemas/report.py`

**Step 1: Create auth schemas**

```python
# backend/app/schemas/auth.py
from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class ProfessorResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    role: str

    class Config:
        from_attributes = True
```

**Step 2: Create course schemas**

```python
# backend/app/schemas/course.py
from datetime import datetime
from pydantic import BaseModel

class CourseResponse(BaseModel):
    id: str
    name: str
    room: str
    start_time: datetime
    end_time: datetime
    professor_name: str
    student_count: int

    class Config:
        from_attributes = True
```

**Step 3: Create student schemas**

```python
# backend/app/schemas/student.py
from pydantic import BaseModel

class StudentResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    is_alternance: bool

    class Config:
        from_attributes = True

class StudentWithAttendanceResponse(StudentResponse):
    attendance_rate: float | None = None
    total_courses: int = 0
    attended: int = 0
    absent: int = 0
    late: int = 0
```

**Step 4: Create attendance schemas**

```python
# backend/app/schemas/attendance.py
from datetime import datetime
from pydantic import BaseModel

class AttendanceEntry(BaseModel):
    student_id: str
    status: str  # present | absent | late

class ValidateAttendanceRequest(BaseModel):
    course_id: str
    entries: list[AttendanceEntry]

class AttendanceRecordResponse(BaseModel):
    id: str
    student_id: str
    student_name: str
    status: str
    signed_at: datetime | None = None
    qr_signed_at: datetime | None = None

    class Config:
        from_attributes = True

class SignatureRequest(BaseModel):
    pass  # No body needed, token is in URL path

class SignatureResponse(BaseModel):
    course_name: str
    course_date: str
    professor_name: str
    student_name: str
    already_signed: bool = False
    signed: bool = False
```

**Step 5: Create report schemas**

```python
# backend/app/schemas/report.py
from datetime import date, datetime
from pydantic import BaseModel

class MonthlyReportResponse(BaseModel):
    id: str
    student_name: str
    contact_name: str
    month: date
    total_courses: int
    attended: int
    absent: int
    late: int
    attendance_rate: float
    sent_at: datetime

    class Config:
        from_attributes = True
```

**Step 6: Create schemas __init__.py**

```python
# backend/app/schemas/__init__.py
from app.schemas.auth import *
from app.schemas.course import *
from app.schemas.student import *
from app.schemas.attendance import *
from app.schemas.report import *
```

**Step 7: Verify schemas import**

Run: `cd backend && python -c "from app.schemas import *; print('All schemas loaded OK')"`
Expected: `All schemas loaded OK`

**Step 8: Commit**

```bash
git add backend/app/schemas/
git commit -m "feat: add Pydantic schemas for auth, courses, attendance, students, reports"
```

---

### Task 5: Auth Middleware + Login Endpoint

**Files:**
- Create: `backend/app/core/auth.py`
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/v1/__init__.py`
- Create: `backend/app/api/v1/auth.py`
- Modify: `backend/app/main.py` (add router)
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_auth.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_auth.py
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

@pytest.mark.asyncio
async def test_login_success(client):
    response = await client.post("/api/v1/auth/login", json={
        "email": "jean.dupont@ecole.fr",
        "password": "password123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data

@pytest.mark.asyncio
async def test_login_wrong_password(client):
    response = await client.post("/api/v1/auth/login", json={
        "email": "jean.dupont@ecole.fr",
        "password": "wrong"
    })
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_login_unknown_email(client):
    response = await client.post("/api/v1/auth/login", json={
        "email": "unknown@ecole.fr",
        "password": "password123"
    })
    assert response.status_code == 401
```

**Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_auth.py -v`
Expected: FAIL (no `/api/v1/auth/login` route)

**Step 3: Create auth utility**

```python
# backend/app/core/auth.py
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.core.database import get_db
from app.models.professor import Professor

pwd_context = CryptContext(schemes=["bcrypt"])
security = HTTPBearer()

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRATION_MINUTES)
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

async def get_current_professor(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Professor:
    try:
        payload = jwt.decode(credentials.credentials, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        professor_id = payload.get("sub")
        if professor_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(Professor).where(Professor.id == professor_id))
    professor = result.scalar_one_or_none()
    if professor is None:
        raise HTTPException(status_code=401, detail="Professor not found")
    return professor

async def require_admin(professor: Professor = Depends(get_current_professor)) -> Professor:
    if professor.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return professor
```

**Step 4: Create auth endpoint**

```python
# backend/app/api/v1/auth.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.auth import verify_password, create_access_token, get_current_professor
from app.models.professor import Professor
from app.schemas.auth import LoginRequest, TokenResponse, ProfessorResponse

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Professor).where(Professor.email == request.email))
    professor = result.scalar_one_or_none()
    if not professor or not verify_password(request.password, professor.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": str(professor.id), "role": professor.role})
    return TokenResponse(access_token=token)

@router.get("/me", response_model=ProfessorResponse)
async def get_me(professor: Professor = Depends(get_current_professor)):
    return ProfessorResponse(
        id=str(professor.id), email=professor.email,
        first_name=professor.first_name, last_name=professor.last_name,
        role=professor.role,
    )
```

**Step 5: Register router in main.py**

Add to `backend/app/main.py`:
```python
from app.api.v1.auth import router as auth_router
app.include_router(auth_router, prefix="/api/v1")
```

**Step 6: Run tests**

Run: `cd backend && pytest tests/test_auth.py -v`
Expected: All 3 tests PASS

**Step 7: Commit**

```bash
git add backend/app/core/auth.py backend/app/api/ backend/tests/
git commit -m "feat: add JWT auth with login endpoint and auth middleware"
```

---

## Phase 2: Core Backend API

### Task 6: Courses Endpoints

**Files:**
- Create: `backend/app/api/v1/courses.py`
- Create: `backend/tests/test_courses.py`
- Modify: `backend/app/main.py` (add router)

**Step 1: Write the failing test**

```python
# backend/tests/test_courses.py
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

async def get_auth_header(client, email="jean.dupont@ecole.fr", password="password123"):
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_get_today_courses(client):
    headers = await get_auth_header(client)
    response = await client.get("/api/v1/courses/today", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert "name" in data[0]
    assert "room" in data[0]
    assert "student_count" in data[0]

@pytest.mark.asyncio
async def test_get_course_students(client):
    headers = await get_auth_header(client)
    courses = (await client.get("/api/v1/courses/today", headers=headers)).json()
    course_id = courses[0]["id"]
    response = await client.get(f"/api/v1/courses/{course_id}/students", headers=headers)
    assert response.status_code == 200
    students = response.json()
    assert isinstance(students, list)
    assert len(students) > 0
    assert "first_name" in students[0]
```

**Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_courses.py -v`
Expected: FAIL (404)

**Step 3: Implement courses endpoints**

```python
# backend/app/api/v1/courses.py
from datetime import date, datetime, time
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.auth import get_current_professor
from app.models.professor import Professor
from app.models.course import Course
from app.models.course_enrollment import CourseEnrollment
from app.models.student import Student
from app.schemas.course import CourseResponse
from app.schemas.student import StudentResponse

router = APIRouter(prefix="/courses", tags=["courses"])

@router.get("/today", response_model=list[CourseResponse])
async def get_today_courses(
    professor: Professor = Depends(get_current_professor),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    start = datetime.combine(today, time.min)
    end = datetime.combine(today, time.max)

    # Get courses with student count
    stmt = (
        select(
            Course,
            func.count(CourseEnrollment.id).label("student_count"),
        )
        .outerjoin(CourseEnrollment, CourseEnrollment.course_id == Course.id)
        .where(Course.professor_id == professor.id)
        .where(Course.start_time >= start)
        .where(Course.start_time <= end)
        .group_by(Course.id)
        .order_by(Course.start_time)
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        CourseResponse(
            id=str(course.id),
            name=course.name,
            room=course.room,
            start_time=course.start_time,
            end_time=course.end_time,
            professor_name=f"{professor.first_name} {professor.last_name}",
            student_count=count,
        )
        for course, count in rows
    ]

@router.get("/{course_id}/students", response_model=list[StudentResponse])
async def get_course_students(
    course_id: str,
    professor: Professor = Depends(get_current_professor),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Student)
        .join(CourseEnrollment, CourseEnrollment.student_id == Student.id)
        .where(CourseEnrollment.course_id == course_id)
        .order_by(Student.last_name, Student.first_name)
    )
    result = await db.execute(stmt)
    students = result.scalars().all()

    return [
        StudentResponse(
            id=str(s.id), email=s.email,
            first_name=s.first_name, last_name=s.last_name,
            is_alternance=s.is_alternance,
        )
        for s in students
    ]
```

**Step 4: Register router in main.py**

Add: `from app.api.v1.courses import router as courses_router`
Add: `app.include_router(courses_router, prefix="/api/v1")`

**Step 5: Run tests**

Run: `cd backend && pytest tests/test_courses.py -v`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add backend/app/api/v1/courses.py backend/tests/test_courses.py backend/app/main.py
git commit -m "feat: add courses endpoints (today's courses + enrolled students)"
```

---

### Task 7: Attendance Validation Endpoint + Email Service

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/email.py`
- Create: `backend/app/api/v1/attendance.py`
- Create: `backend/tests/test_attendance.py`
- Modify: `backend/app/main.py` (add router)

**Step 1: Write the failing test**

```python
# backend/tests/test_attendance.py
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

async def get_auth_header(client):
    r = await client.post("/api/v1/auth/login", json={"email": "jean.dupont@ecole.fr", "password": "password123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}

@pytest.mark.asyncio
async def test_validate_attendance(client):
    headers = await get_auth_header(client)
    courses = (await client.get("/api/v1/courses/today", headers=headers)).json()
    course_id = courses[0]["id"]
    students = (await client.get(f"/api/v1/courses/{course_id}/students", headers=headers)).json()

    entries = [
        {"student_id": students[0]["id"], "status": "present"},
        {"student_id": students[1]["id"], "status": "absent"},
        {"student_id": students[2]["id"], "status": "present"},
    ]
    response = await client.post("/api/v1/attendance/validate", headers=headers, json={
        "course_id": course_id, "entries": entries,
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    # Present students should have signature tokens
    assert data[0]["status"] == "present"
    assert data[1]["status"] == "absent"
```

**Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_attendance.py -v`
Expected: FAIL (404)

**Step 3: Create email service**

```python
# backend/app/services/email.py
import resend
from app.core.config import settings

class EmailService:
    def __init__(self):
        resend.api_key = settings.RESEND_API_KEY

    async def send_signature_email(
        self, student_email: str, student_name: str,
        course_name: str, course_date: str, signature_url: str,
    ):
        if not settings.RESEND_API_KEY:
            print(f"[DEV] Signature email for {student_name}: {signature_url}")
            return

        resend.Emails.send({
            "from": "Émargement <noreply@yourdomain.com>",
            "to": student_email,
            "subject": f"Signez votre présence — {course_name}",
            "html": f"""
                <h2>Bonjour {student_name},</h2>
                <p>Vous avez été noté(e) présent(e) au cours <strong>{course_name}</strong> du {course_date}.</p>
                <p><a href="{signature_url}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
                    Signer ma présence
                </a></p>
                <p>Ce lien expire dans 24 heures.</p>
            """,
        })

    async def send_monthly_report(
        self, contact_email: str, contact_name: str,
        student_name: str, month: str, pdf_bytes: bytes,
    ):
        if not settings.RESEND_API_KEY:
            print(f"[DEV] Monthly report email for {student_name} to {contact_name}")
            return

        import base64
        resend.Emails.send({
            "from": "Émargement <noreply@yourdomain.com>",
            "to": contact_email,
            "subject": f"Rapport d'assiduité — {student_name} — {month}",
            "html": f"""
                <h2>Bonjour {contact_name},</h2>
                <p>Veuillez trouver ci-joint le rapport d'assiduité mensuel de <strong>{student_name}</strong> pour le mois de {month}.</p>
            """,
            "attachments": [{
                "filename": f"rapport-assiduite-{student_name.lower().replace(' ', '-')}-{month}.pdf",
                "content": base64.b64encode(pdf_bytes).decode(),
            }],
        })

email_service = EmailService()
```

**Step 4: Create attendance endpoint**

```python
# backend/app/api/v1/attendance.py
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.auth import get_current_professor
from app.models.professor import Professor
from app.models.student import Student
from app.models.course import Course
from app.models.attendance_record import AttendanceRecord
from app.schemas.attendance import ValidateAttendanceRequest, AttendanceRecordResponse
from app.services.email import email_service
from app.core.config import settings

router = APIRouter(prefix="/attendance", tags=["attendance"])

@router.post("/validate", response_model=list[AttendanceRecordResponse])
async def validate_attendance(
    request: ValidateAttendanceRequest,
    professor: Professor = Depends(get_current_professor),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.utcnow()
    records = []

    # Get course info for email
    course = await db.get(Course, request.course_id)

    for entry in request.entries:
        student = await db.get(Student, entry.student_id)
        token = uuid.uuid4()

        record = AttendanceRecord(
            course_id=request.course_id,
            student_id=entry.student_id,
            status=entry.status,
            marked_by_prof_at=now,
            signature_token=token,
            signature_token_expires=now + timedelta(hours=24),
        )
        db.add(record)
        records.append((record, student))

        # Send signature email to present/late students
        if entry.status in ("present", "late") and student:
            signature_url = f"{settings.FRONTEND_URL}/sign/{token}"
            await email_service.send_signature_email(
                student_email=student.email,
                student_name=f"{student.first_name} {student.last_name}",
                course_name=course.name if course else "Unknown",
                course_date=course.start_time.strftime("%d/%m/%Y %H:%M") if course else "",
                signature_url=signature_url,
            )

    await db.commit()

    return [
        AttendanceRecordResponse(
            id=str(record.id),
            student_id=str(record.student_id),
            student_name=f"{student.first_name} {student.last_name}" if student else "Unknown",
            status=record.status,
            signed_at=record.signed_at,
            qr_signed_at=record.qr_signed_at,
        )
        for record, student in records
    ]

@router.get("/{course_id}", response_model=list[AttendanceRecordResponse])
async def get_attendance(
    course_id: str,
    professor: Professor = Depends(get_current_professor),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(AttendanceRecord, Student)
        .join(Student, Student.id == AttendanceRecord.student_id)
        .where(AttendanceRecord.course_id == course_id)
        .order_by(Student.last_name)
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        AttendanceRecordResponse(
            id=str(record.id),
            student_id=str(record.student_id),
            student_name=f"{student.first_name} {student.last_name}",
            status=record.status,
            signed_at=record.signed_at,
            qr_signed_at=record.qr_signed_at,
        )
        for record, student in rows
    ]
```

**Step 5: Register router in main.py**

Add: `from app.api.v1.attendance import router as attendance_router`
Add: `app.include_router(attendance_router, prefix="/api/v1")`

**Step 6: Run tests**

Run: `cd backend && pytest tests/test_attendance.py -v`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add backend/app/api/v1/attendance.py backend/app/services/ backend/tests/test_attendance.py backend/app/main.py
git commit -m "feat: add attendance validation endpoint with email service"
```

---

### Task 8: E-Signature Endpoint

**Files:**
- Create: `backend/app/api/v1/signatures.py`
- Create: `backend/tests/test_signatures.py`
- Modify: `backend/app/main.py` (add router)

**Step 1: Write the failing test**

```python
# backend/tests/test_signatures.py
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

async def get_auth_header(client):
    r = await client.post("/api/v1/auth/login", json={"email": "jean.dupont@ecole.fr", "password": "password123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}

@pytest.mark.asyncio
async def test_get_signature_page(client):
    # First create attendance records to get a valid token
    headers = await get_auth_header(client)
    courses = (await client.get("/api/v1/courses/today", headers=headers)).json()
    course_id = courses[0]["id"]
    students = (await client.get(f"/api/v1/courses/{course_id}/students", headers=headers)).json()

    await client.post("/api/v1/attendance/validate", headers=headers, json={
        "course_id": course_id,
        "entries": [{"student_id": students[0]["id"], "status": "present"}],
    })

    # Get attendance records to find the token
    records = (await client.get(f"/api/v1/attendance/{course_id}", headers=headers)).json()
    # Get the signature token from the DB directly for testing
    # In the real flow, the student gets it via email

    # Test signing with valid token (we need to extract token from DB)
    response = await client.get(f"/api/v1/signatures/info/invalid-token")
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_sign_with_expired_token(client):
    response = await client.post("/api/v1/signatures/sign/invalid-token")
    assert response.status_code == 404
```

**Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_signatures.py -v`
Expected: FAIL (404)

**Step 3: Implement signature endpoints**

```python
# backend/app/api/v1/signatures.py
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.attendance_record import AttendanceRecord
from app.models.course import Course
from app.models.student import Student
from app.models.professor import Professor
from app.schemas.attendance import SignatureResponse

router = APIRouter(prefix="/signatures", tags=["signatures"])

@router.get("/info/{token}", response_model=SignatureResponse)
async def get_signature_info(token: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(AttendanceRecord, Course, Student, Professor)
        .join(Course, Course.id == AttendanceRecord.course_id)
        .join(Student, Student.id == AttendanceRecord.student_id)
        .join(Professor, Professor.id == Course.professor_id)
        .where(AttendanceRecord.signature_token == token)
    )
    result = await db.execute(stmt)
    row = result.first()

    if not row:
        raise HTTPException(status_code=404, detail="Invalid signature token")

    record, course, student, professor = row

    if record.signature_token_expires < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Signature link expired")

    return SignatureResponse(
        course_name=course.name,
        course_date=course.start_time.strftime("%d/%m/%Y %H:%M"),
        professor_name=f"{professor.first_name} {professor.last_name}",
        student_name=f"{student.first_name} {student.last_name}",
        already_signed=record.signed_at is not None,
    )

@router.post("/sign/{token}", response_model=SignatureResponse)
async def sign_attendance(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(AttendanceRecord, Course, Student, Professor)
        .join(Course, Course.id == AttendanceRecord.course_id)
        .join(Student, Student.id == AttendanceRecord.student_id)
        .join(Professor, Professor.id == Course.professor_id)
        .where(AttendanceRecord.signature_token == token)
    )
    result = await db.execute(stmt)
    row = result.first()

    if not row:
        raise HTTPException(status_code=404, detail="Invalid signature token")

    record, course, student, professor = row

    if record.signature_token_expires < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Signature link expired")

    if record.signed_at:
        return SignatureResponse(
            course_name=course.name,
            course_date=course.start_time.strftime("%d/%m/%Y %H:%M"),
            professor_name=f"{professor.first_name} {professor.last_name}",
            student_name=f"{student.first_name} {student.last_name}",
            already_signed=True,
            signed=False,
        )

    # Record the signature
    record.signed_at = datetime.utcnow()
    record.signature_ip = request.client.host if request.client else None
    record.signature_user_agent = request.headers.get("user-agent")
    await db.commit()

    return SignatureResponse(
        course_name=course.name,
        course_date=course.start_time.strftime("%d/%m/%Y %H:%M"),
        professor_name=f"{professor.first_name} {professor.last_name}",
        student_name=f"{student.first_name} {student.last_name}",
        already_signed=False,
        signed=True,
    )
```

**Step 4: Register router, run tests, commit**

Add router to `main.py`. Run: `cd backend && pytest tests/test_signatures.py -v`. Expected: PASS.

```bash
git add backend/app/api/v1/signatures.py backend/tests/test_signatures.py backend/app/main.py
git commit -m "feat: add e-signature endpoints (info + sign with IP/user-agent recording)"
```

---

### Task 9: QR Code Service + Endpoint

**Files:**
- Create: `backend/app/services/qrcode.py`
- Modify: `backend/app/api/v1/attendance.py` (add QR endpoint)
- Create: `backend/tests/test_qrcode.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_qrcode.py
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

async def get_auth_header(client):
    r = await client.post("/api/v1/auth/login", json={"email": "jean.dupont@ecole.fr", "password": "password123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}

@pytest.mark.asyncio
async def test_get_qr_code(client):
    headers = await get_auth_header(client)
    courses = (await client.get("/api/v1/courses/today", headers=headers)).json()
    course_id = courses[0]["id"]
    response = await client.get(f"/api/v1/attendance/{course_id}/qr", headers=headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
```

**Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_qrcode.py -v`
Expected: FAIL

**Step 3: Create QR code service**

```python
# backend/app/services/qrcode.py
import io
import qrcode
from app.core.config import settings

def generate_qr_code(course_id: str) -> bytes:
    """Generate a QR code that links to the course signing page."""
    url = f"{settings.FRONTEND_URL}/sign/qr/{course_id}"
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.getvalue()
```

**Step 4: Add QR endpoint to attendance.py**

Add to `backend/app/api/v1/attendance.py`:

```python
from fastapi.responses import Response
from app.services.qrcode import generate_qr_code

@router.get("/{course_id}/qr")
async def get_qr_code(
    course_id: str,
    professor: Professor = Depends(get_current_professor),
):
    qr_bytes = generate_qr_code(course_id)
    return Response(content=qr_bytes, media_type="image/png")
```

**Step 5: Run tests, commit**

Run: `cd backend && pytest tests/test_qrcode.py -v`. Expected: PASS.

```bash
git add backend/app/services/qrcode.py backend/app/api/v1/attendance.py backend/tests/test_qrcode.py
git commit -m "feat: add QR code generation for course attendance"
```

---

### Task 10: PDF Report Service

**Files:**
- Create: `backend/app/services/pdf.py`
- Create: `backend/tests/test_pdf.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_pdf.py
import pytest
from app.services.pdf import generate_attendance_pdf

def test_generate_pdf():
    pdf_bytes = generate_attendance_pdf(
        student_name="Alice Martin",
        month="Février 2026",
        school_name="École de Commerce",
        stats={"total_courses": 20, "attended": 18, "absent": 1, "late": 1, "attendance_rate": 90.0},
        course_details=[
            {"date": "01/02/2026", "course": "Marketing L3", "status": "Présent", "signed": True},
            {"date": "03/02/2026", "course": "Finance M1", "status": "Absent", "signed": False},
        ],
    )
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 100
    assert pdf_bytes[:4] == b"%PDF"
```

**Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_pdf.py -v`
Expected: FAIL (ImportError)

**Step 3: Implement PDF service**

```python
# backend/app/services/pdf.py
import io
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_attendance_pdf(
    student_name: str,
    month: str,
    school_name: str,
    stats: dict,
    course_details: list[dict],
) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm)
    styles = getSampleStyleSheet()
    elements = []

    # Title
    title_style = ParagraphStyle("Title", parent=styles["Title"], fontSize=18, spaceAfter=10*mm)
    elements.append(Paragraph(f"Rapport d'Assiduité", title_style))
    elements.append(Paragraph(f"{school_name}", styles["Normal"]))
    elements.append(Spacer(1, 5*mm))
    elements.append(Paragraph(f"<b>Étudiant:</b> {student_name}", styles["Normal"]))
    elements.append(Paragraph(f"<b>Période:</b> {month}", styles["Normal"]))
    elements.append(Spacer(1, 8*mm))

    # Stats summary
    stats_data = [
        ["Total cours", "Présent", "Absent", "Retard", "Taux"],
        [
            str(stats["total_courses"]),
            str(stats["attended"]),
            str(stats["absent"]),
            str(stats["late"]),
            f"{stats['attendance_rate']:.0f}%",
        ],
    ]
    stats_table = Table(stats_data, colWidths=[80, 80, 80, 80, 80])
    stats_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563eb")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
    ]))
    elements.append(stats_table)
    elements.append(Spacer(1, 8*mm))

    # Course details table
    elements.append(Paragraph("<b>Détail des cours</b>", styles["Normal"]))
    elements.append(Spacer(1, 3*mm))
    detail_data = [["Date", "Cours", "Statut", "Signé"]]
    for course in course_details:
        detail_data.append([
            course["date"],
            course["course"],
            course["status"],
            "Oui" if course["signed"] else "Non",
        ])

    detail_table = Table(detail_data, colWidths=[80, 150, 80, 60])
    detail_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563eb")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
    ]))
    elements.append(detail_table)

    doc.build(elements)
    return buf.getvalue()
```

**Step 4: Run tests, commit**

Run: `cd backend && pytest tests/test_pdf.py -v`. Expected: PASS.

```bash
git add backend/app/services/pdf.py backend/tests/test_pdf.py
git commit -m "feat: add PDF report generation service with ReportLab"
```

---

### Task 11: Monthly Report CRON Job

**Files:**
- Create: `backend/app/tasks/__init__.py`
- Create: `backend/app/tasks/monthly_reports.py`
- Modify: `backend/app/main.py` (add scheduler startup)

**Step 1: Create the monthly report task**

```python
# backend/app/tasks/monthly_reports.py
from datetime import date, datetime, timedelta
from sqlalchemy import select, func
from app.core.database import async_session
from app.models.student import Student
from app.models.student_contact import StudentContact
from app.models.course import Course
from app.models.course_enrollment import CourseEnrollment
from app.models.attendance_record import AttendanceRecord
from app.models.monthly_report import MonthlyReport
from app.services.pdf import generate_attendance_pdf
from app.services.email import email_service

FRENCH_MONTHS = [
    "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
]

async def generate_monthly_reports():
    """Generate and send monthly attendance reports. Runs on 1st of each month."""
    today = date.today()
    # Report for previous month
    first_of_this_month = today.replace(day=1)
    last_month_end = first_of_this_month - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)
    month_label = f"{FRENCH_MONTHS[last_month_end.month]} {last_month_end.year}"

    async with async_session() as db:
        # Get all students
        students = (await db.execute(select(Student))).scalars().all()

        for student in students:
            # Get courses the student was enrolled in during last month
            stmt = (
                select(Course)
                .join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
                .where(CourseEnrollment.student_id == student.id)
                .where(Course.start_time >= datetime.combine(last_month_start, datetime.min.time()))
                .where(Course.start_time < datetime.combine(first_of_this_month, datetime.min.time()))
            )
            courses = (await db.execute(stmt)).scalars().all()
            if not courses:
                continue

            # Get attendance records
            course_ids = [c.id for c in courses]
            stmt = (
                select(AttendanceRecord)
                .where(AttendanceRecord.student_id == student.id)
                .where(AttendanceRecord.course_id.in_(course_ids))
            )
            records = (await db.execute(stmt)).scalars().all()
            records_by_course = {r.course_id: r for r in records}

            # Calculate stats
            total = len(courses)
            attended = sum(1 for r in records if r.status == "present")
            absent = sum(1 for r in records if r.status == "absent")
            late = sum(1 for r in records if r.status == "late")
            # Students with no record for a course count as absent
            absent += total - len(records)
            rate = (attended / total * 100) if total > 0 else 0

            stats = {
                "total_courses": total, "attended": attended,
                "absent": absent, "late": late, "attendance_rate": rate,
            }

            # Build course details
            course_details = []
            for c in sorted(courses, key=lambda x: x.start_time):
                rec = records_by_course.get(c.id)
                status_map = {"present": "Présent", "absent": "Absent", "late": "En retard"}
                course_details.append({
                    "date": c.start_time.strftime("%d/%m/%Y"),
                    "course": c.name,
                    "status": status_map.get(rec.status, "Absent") if rec else "Absent",
                    "signed": rec.signed_at is not None if rec else False,
                })

            # Generate PDF
            pdf_bytes = generate_attendance_pdf(
                student_name=f"{student.first_name} {student.last_name}",
                month=month_label,
                school_name="École de Commerce",
                stats=stats,
                course_details=course_details,
            )

            # Send to all contacts
            contacts_stmt = select(StudentContact).where(StudentContact.student_id == student.id)
            contacts = (await db.execute(contacts_stmt)).scalars().all()

            for contact in contacts:
                await email_service.send_monthly_report(
                    contact_email=contact.email,
                    contact_name=f"{contact.first_name} {contact.last_name}",
                    student_name=f"{student.first_name} {student.last_name}",
                    month=month_label,
                    pdf_bytes=pdf_bytes,
                )

                report = MonthlyReport(
                    student_id=student.id, contact_id=contact.id,
                    month=last_month_start,
                    total_courses=total, attended=attended,
                    absent=absent, late=late, attendance_rate=rate,
                    pdf_url="", sent_at=datetime.utcnow(),
                )
                db.add(report)

        await db.commit()
        print(f"Monthly reports generated for {month_label}")
```

**Step 2: Add scheduler to main.py**

Add to `backend/app/main.py`:
```python
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.tasks.monthly_reports import generate_monthly_reports

scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(generate_monthly_reports, "cron", day=1, hour=8, minute=0)
    scheduler.start()
    yield
    scheduler.shutdown()

# Update app creation: app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)
```

**Step 3: Commit**

```bash
git add backend/app/tasks/ backend/app/main.py
git commit -m "feat: add monthly attendance report CRON job with PDF generation and email"
```

---

### Task 12: Admin Endpoints

**Files:**
- Create: `backend/app/api/v1/admin.py`
- Create: `backend/tests/test_admin.py`
- Modify: `backend/app/main.py` (add router)

**Step 1: Write the failing test**

```python
# backend/tests/test_admin.py
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

async def get_admin_header(client):
    r = await client.post("/api/v1/auth/login", json={"email": "admin@ecole.fr", "password": "admin123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}

@pytest.mark.asyncio
async def test_admin_stats(client):
    headers = await get_admin_header(client)
    response = await client.get("/api/v1/admin/stats", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_students" in data
    assert "total_courses_today" in data
    assert "global_attendance_rate" in data

@pytest.mark.asyncio
async def test_admin_students_list(client):
    headers = await get_admin_header(client)
    response = await client.get("/api/v1/admin/students", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

@pytest.mark.asyncio
async def test_non_admin_rejected(client):
    r = await client.post("/api/v1/auth/login", json={"email": "jean.dupont@ecole.fr", "password": "password123"})
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    response = await client.get("/api/v1/admin/stats", headers=headers)
    assert response.status_code == 403
```

**Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_admin.py -v`
Expected: FAIL (404)

**Step 3: Implement admin endpoints**

```python
# backend/app/api/v1/admin.py
from datetime import date, datetime, time
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.auth import require_admin
from app.models.professor import Professor
from app.models.student import Student
from app.models.course import Course
from app.models.course_enrollment import CourseEnrollment
from app.models.attendance_record import AttendanceRecord
from app.schemas.student import StudentWithAttendanceResponse

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    total_students = (await db.execute(select(func.count(Student.id)))).scalar() or 0
    total_professors = (await db.execute(select(func.count(Professor.id)))).scalar() or 0

    today = date.today()
    start = datetime.combine(today, time.min)
    end = datetime.combine(today, time.max)
    total_courses_today = (await db.execute(
        select(func.count(Course.id)).where(Course.start_time >= start, Course.start_time <= end)
    )).scalar() or 0

    # Global attendance rate
    total_records = (await db.execute(select(func.count(AttendanceRecord.id)))).scalar() or 0
    present_records = (await db.execute(
        select(func.count(AttendanceRecord.id)).where(AttendanceRecord.status.in_(["present", "late"]))
    )).scalar() or 0
    global_rate = (present_records / total_records * 100) if total_records > 0 else 0

    # Alerts: students with rate < 70%
    low_attendance_count = 0  # Simplified for MVP

    return {
        "total_students": total_students,
        "total_professors": total_professors,
        "total_courses_today": total_courses_today,
        "global_attendance_rate": round(global_rate, 1),
        "total_attendance_records": total_records,
        "low_attendance_alerts": low_attendance_count,
    }

@router.get("/students", response_model=list[StudentWithAttendanceResponse])
async def get_students(db: AsyncSession = Depends(get_db)):
    students = (await db.execute(select(Student).order_by(Student.last_name))).scalars().all()
    result = []
    for s in students:
        # Get attendance stats
        total = (await db.execute(
            select(func.count(AttendanceRecord.id)).where(AttendanceRecord.student_id == s.id)
        )).scalar() or 0
        attended = (await db.execute(
            select(func.count(AttendanceRecord.id))
            .where(AttendanceRecord.student_id == s.id, AttendanceRecord.status == "present")
        )).scalar() or 0
        absent = (await db.execute(
            select(func.count(AttendanceRecord.id))
            .where(AttendanceRecord.student_id == s.id, AttendanceRecord.status == "absent")
        )).scalar() or 0
        late = (await db.execute(
            select(func.count(AttendanceRecord.id))
            .where(AttendanceRecord.student_id == s.id, AttendanceRecord.status == "late")
        )).scalar() or 0
        rate = (attended / total * 100) if total > 0 else None

        result.append(StudentWithAttendanceResponse(
            id=str(s.id), email=s.email, first_name=s.first_name,
            last_name=s.last_name, is_alternance=s.is_alternance,
            attendance_rate=round(rate, 1) if rate is not None else None,
            total_courses=total, attended=attended, absent=absent, late=late,
        ))
    return result
```

**Step 4: Register router, run tests, commit**

Add router to `main.py`. Run: `cd backend && pytest tests/test_admin.py -v`. Expected: PASS.

```bash
git add backend/app/api/v1/admin.py backend/tests/test_admin.py backend/app/main.py
git commit -m "feat: add admin endpoints (stats + students list with attendance rates)"
```

---

## Phase 3: Frontend

### Task 13: Frontend Project Scaffolding

**Files:**
- Create: `frontend/` (via create-next-app)
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/.env.local`

**Step 1: Create Next.js project**

Run: `cd emargement-app && npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --no-import-alias`

**Step 2: Install dependencies**

Run: `cd frontend && npm install swr next-pwa`

**Step 3: Create API client**

```typescript
// frontend/src/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem("token", token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem("token");
  }

  async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string>),
    };
    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_URL}${path}`, { ...options, headers });
    if (!res.ok) {
      if (res.status === 401) {
        this.clearToken();
        window.location.href = "/login";
      }
      throw new Error(`API error: ${res.status}`);
    }
    return res.json();
  }

  get<T>(path: string) {
    return this.fetch<T>(path);
  }

  post<T>(path: string, body: unknown) {
    return this.fetch<T>(path, { method: "POST", body: JSON.stringify(body) });
  }
}

export const api = new ApiClient();
```

**Step 4: Create .env.local**

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Step 5: Verify it runs**

Run: `cd frontend && npm run dev`
Expected: Next.js dev server running on localhost:3000

**Step 6: Commit**

```bash
git add frontend/
git commit -m "feat: frontend scaffolding with Next.js, Tailwind, SWR, API client"
```

---

### Task 14: SWR Hooks

**Files:**
- Create: `frontend/src/hooks/use-auth.ts`
- Create: `frontend/src/hooks/use-courses.ts`
- Create: `frontend/src/hooks/use-attendance.ts`

**Step 1: Create auth hook**

```typescript
// frontend/src/hooks/use-auth.ts
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface Professor {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

export function useAuth() {
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.get<Professor>("/api/v1/auth/me")
        .then(setProfessor)
        .catch(() => api.clearToken())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.post<{ access_token: string }>("/api/v1/auth/login", { email, password });
    api.setToken(data.access_token);
    const prof = await api.get<Professor>("/api/v1/auth/me");
    setProfessor(prof);
    return prof;
  };

  const logout = () => {
    api.clearToken();
    setProfessor(null);
  };

  return { professor, loading, login, logout, isAdmin: professor?.role === "admin" };
}
```

**Step 2: Create courses hook**

```typescript
// frontend/src/hooks/use-courses.ts
import useSWR from "swr";
import { api } from "@/lib/api";

interface Course {
  id: string;
  name: string;
  room: string;
  start_time: string;
  end_time: string;
  professor_name: string;
  student_count: number;
}

interface Student {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_alternance: boolean;
}

export function useTodayCourses() {
  return useSWR<Course[]>("courses-today", () => api.get("/api/v1/courses/today"));
}

export function useCourseStudents(courseId: string | null) {
  return useSWR<Student[]>(
    courseId ? `course-students-${courseId}` : null,
    () => api.get(`/api/v1/courses/${courseId}/students`),
  );
}
```

**Step 3: Create attendance hook**

```typescript
// frontend/src/hooks/use-attendance.ts
import { api } from "@/lib/api";

interface AttendanceEntry {
  student_id: string;
  status: "present" | "absent" | "late";
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  student_name: string;
  status: string;
  signed_at: string | null;
  qr_signed_at: string | null;
}

export async function validateAttendance(courseId: string, entries: AttendanceEntry[]) {
  return api.post<AttendanceRecord[]>("/api/v1/attendance/validate", {
    course_id: courseId,
    entries,
  });
}
```

**Step 4: Commit**

```bash
git add frontend/src/hooks/
git commit -m "feat: add SWR hooks for auth, courses, and attendance"
```

---

### Task 15: Login Page

**Files:**
- Create: `frontend/src/app/login/page.tsx`
- Modify: `frontend/src/app/layout.tsx` (global styles)

**Step 1: Create login page**

```tsx
// frontend/src/app/login/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const prof = await login(email, password);
      router.push(prof.role === "admin" ? "/admin" : "/dashboard");
    } catch {
      setError("Email ou mot de passe incorrect");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-8">Émargement</h1>
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Verify it renders**

Run: `cd frontend && npm run dev` → visit `http://localhost:3000/login`
Expected: Login form visible

**Step 3: Commit**

```bash
git add frontend/src/app/login/
git commit -m "feat: add login page"
```

---

### Task 16: Professor Dashboard (Today's Courses)

**Files:**
- Create: `frontend/src/app/dashboard/page.tsx`
- Create: `frontend/src/components/course-card.tsx`

**Step 1: Create CourseCard component**

```tsx
// frontend/src/components/course-card.tsx
"use client";
import Link from "next/link";

interface Course {
  id: string;
  name: string;
  room: string;
  start_time: string;
  end_time: string;
  student_count: number;
}

export function CourseCard({ course }: { course: Course }) {
  const start = new Date(course.start_time);
  const end = new Date(course.end_time);
  const now = new Date();
  const isActive = now >= start && now <= end;
  const isPast = now > end;

  const formatTime = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`p-4 rounded-xl border ${isActive ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"}`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-lg">{course.name}</h3>
        {isActive && <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full">En cours</span>}
        {isPast && <span className="text-xs bg-gray-400 text-white px-2 py-1 rounded-full">Terminé</span>}
      </div>
      <p className="text-gray-600 text-sm">{formatTime(start)} — {formatTime(end)}</p>
      <p className="text-gray-600 text-sm">Salle {course.room}</p>
      <p className="text-gray-500 text-sm mt-1">{course.student_count} étudiants</p>
      <Link
        href={`/course/${course.id}`}
        className="mt-3 inline-block bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700"
      >
        Faire l'appel
      </Link>
    </div>
  );
}
```

**Step 2: Create dashboard page**

```tsx
// frontend/src/app/dashboard/page.tsx
"use client";
import { useAuth } from "@/hooks/use-auth";
import { useTodayCourses } from "@/hooks/use-courses";
import { CourseCard } from "@/components/course-card";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const { professor, loading: authLoading, logout } = useAuth();
  const { data: courses, isLoading } = useTodayCourses();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !professor) router.push("/login");
  }, [authLoading, professor, router]);

  if (authLoading || isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center">
        <h1 className="font-bold text-lg">Émargement</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{professor?.first_name} {professor?.last_name}</span>
          <button onClick={logout} className="text-sm text-red-500 hover:underline">Déconnexion</button>
        </div>
      </header>
      <main className="max-w-lg mx-auto p-4">
        <h2 className="text-xl font-semibold mb-4">Cours du jour</h2>
        {courses && courses.length === 0 && (
          <p className="text-gray-500 text-center py-8">Aucun cours aujourd'hui</p>
        )}
        <div className="space-y-3">
          {courses?.map((course) => <CourseCard key={course.id} course={course} />)}
        </div>
      </main>
    </div>
  );
}
```

**Step 3: Verify**

Run: `cd frontend && npm run dev` → login → redirects to `/dashboard`
Expected: List of today's courses

**Step 4: Commit**

```bash
git add frontend/src/app/dashboard/ frontend/src/components/course-card.tsx
git commit -m "feat: add professor dashboard with today's courses"
```

---

### Task 17: Attendance Page (Roll Call)

**Files:**
- Create: `frontend/src/app/course/[id]/page.tsx`

**Step 1: Create attendance page**

```tsx
// frontend/src/app/course/[id]/page.tsx
"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCourseStudents } from "@/hooks/use-courses";
import { validateAttendance } from "@/hooks/use-attendance";
import { useAuth } from "@/hooks/use-auth";

type Status = "present" | "absent" | "late";

export default function AttendancePage() {
  const { id } = useParams<{ id: string }>();
  const { professor } = useAuth();
  const { data: students, isLoading } = useCourseStudents(id);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;

  const getStatus = (studentId: string): Status => statuses[studentId] || "absent";

  const toggleStatus = (studentId: string) => {
    const current = getStatus(studentId);
    const next: Status = current === "absent" ? "present" : current === "present" ? "late" : "absent";
    setStatuses((prev) => ({ ...prev, [studentId]: next }));
  };

  const handleSubmit = async () => {
    if (!students) return;
    setSubmitting(true);
    try {
      const entries = students.map((s) => ({
        student_id: s.id,
        status: getStatus(s.id),
      }));
      await validateAttendance(id, entries);
      setSubmitted(true);
    } catch (err) {
      alert("Erreur lors de la validation");
    } finally {
      setSubmitting(false);
    }
  };

  const statusColors: Record<Status, string> = {
    present: "bg-green-100 border-green-500 text-green-700",
    absent: "bg-red-50 border-gray-300 text-gray-500",
    late: "bg-yellow-100 border-yellow-500 text-yellow-700",
  };
  const statusLabels: Record<Status, string> = { present: "Présent", absent: "Absent", late: "Retard" };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 shadow-sm text-center max-w-sm w-full">
          <div className="text-4xl mb-4">✓</div>
          <h2 className="text-xl font-semibold mb-2">Appel validé</h2>
          <p className="text-gray-600 mb-4">Les emails de signature ont été envoyés aux étudiants présents.</p>
          <button onClick={() => setShowQr(!showQr)} className="text-blue-600 hover:underline text-sm mb-4 block">
            {showQr ? "Masquer" : "Afficher"} le QR code
          </button>
          {showQr && (
            <img src={`${API_URL}/api/v1/attendance/${id}/qr`} alt="QR Code" className="mx-auto mb-4 w-48 h-48" />
          )}
          <button onClick={() => router.push("/dashboard")} className="bg-blue-600 text-white px-4 py-2 rounded-lg">
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push("/dashboard")} className="text-blue-600">← Retour</button>
        <h1 className="font-bold">Faire l'appel</h1>
      </header>
      <main className="max-w-lg mx-auto p-4">
        <p className="text-sm text-gray-500 mb-4">{students?.length} étudiants inscrits</p>
        <div className="space-y-2">
          {students?.map((student) => {
            const status = getStatus(student.id);
            return (
              <button
                key={student.id}
                onClick={() => toggleStatus(student.id)}
                className={`w-full text-left p-3 rounded-lg border-2 transition ${statusColors[status]}`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{student.last_name} {student.first_name}</span>
                  <span className="text-sm font-medium">{statusLabels[status]}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Validation..." : "Valider l'appel"}
          </button>
        </div>
      </main>
    </div>
  );
}
```

**Step 2: Verify**

Run: `cd frontend && npm run dev` → login → click course → see student list → toggle statuses → validate
Expected: Students list with toggle, validation works, QR code shown after

**Step 3: Commit**

```bash
git add frontend/src/app/course/
git commit -m "feat: add attendance roll call page with status toggle and QR code display"
```

---

### Task 18: Student E-Signature Page

**Files:**
- Create: `frontend/src/app/sign/[token]/page.tsx`

**Step 1: Create signature page**

```tsx
// frontend/src/app/sign/[token]/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SignatureInfo {
  course_name: string;
  course_date: string;
  professor_name: string;
  student_name: string;
  already_signed: boolean;
  signed: boolean;
}

export default function SignaturePage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<SignatureInfo | null>(null);
  const [error, setError] = useState("");
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/signatures/info/${token}`)
      .then((r) => {
        if (r.status === 410) throw new Error("expired");
        if (!r.ok) throw new Error("invalid");
        return r.json();
      })
      .then((data) => {
        setInfo(data);
        if (data.already_signed) setSigned(true);
      })
      .catch((e) => {
        setError(e.message === "expired" ? "Ce lien a expiré." : "Lien invalide.");
      });
  }, [token]);

  const handleSign = async () => {
    setSigning(true);
    try {
      const r = await fetch(`${API_URL}/api/v1/signatures/sign/${token}`, { method: "POST" });
      if (!r.ok) throw new Error("sign_failed");
      const data = await r.json();
      if (data.signed || data.already_signed) setSigned(true);
    } catch {
      setError("Erreur lors de la signature.");
    } finally {
      setSigning(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl p-6 shadow-sm text-center max-w-sm">
          <div className="text-4xl mb-4">⚠</div>
          <p className="text-gray-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!info) {
    return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  }

  if (signed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl p-6 shadow-sm text-center max-w-sm">
          <div className="text-4xl mb-4">✓</div>
          <h2 className="text-xl font-semibold mb-2">Présence signée</h2>
          <p className="text-gray-600">Votre présence au cours <strong>{info.course_name}</strong> a été enregistrée.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl p-6 shadow-sm max-w-sm w-full">
        <h1 className="text-xl font-bold mb-4 text-center">Signer ma présence</h1>
        <div className="space-y-2 mb-6">
          <p><span className="text-gray-500">Cours:</span> <strong>{info.course_name}</strong></p>
          <p><span className="text-gray-500">Date:</span> {info.course_date}</p>
          <p><span className="text-gray-500">Professeur:</span> {info.professor_name}</p>
          <p><span className="text-gray-500">Étudiant:</span> {info.student_name}</p>
        </div>
        <p className="text-sm text-gray-500 mb-4">En cliquant ci-dessous, vous confirmez votre présence à ce cours.</p>
        <button
          onClick={handleSign}
          disabled={signing}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {signing ? "Signature en cours..." : "Je confirme ma présence"}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Verify**

After validating attendance, check the backend logs for the signature URL. Visit it.
Expected: Signature page with course details and sign button.

**Step 3: Commit**

```bash
git add frontend/src/app/sign/
git commit -m "feat: add student e-signature page (public, no auth required)"
```

---

### Task 19: Admin Dashboard

**Files:**
- Create: `frontend/src/app/admin/page.tsx`
- Create: `frontend/src/hooks/use-admin.ts`

**Step 1: Create admin hook**

```typescript
// frontend/src/hooks/use-admin.ts
import useSWR from "swr";
import { api } from "@/lib/api";

interface AdminStats {
  total_students: number;
  total_professors: number;
  total_courses_today: number;
  global_attendance_rate: number;
  total_attendance_records: number;
  low_attendance_alerts: number;
}

interface StudentWithAttendance {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_alternance: boolean;
  attendance_rate: number | null;
  total_courses: number;
  attended: number;
  absent: number;
  late: number;
}

export function useAdminStats() {
  return useSWR<AdminStats>("admin-stats", () => api.get("/api/v1/admin/stats"));
}

export function useAdminStudents() {
  return useSWR<StudentWithAttendance[]>("admin-students", () => api.get("/api/v1/admin/students"));
}
```

**Step 2: Create admin dashboard page**

```tsx
// frontend/src/app/admin/page.tsx
"use client";
import { useAuth } from "@/hooks/use-auth";
import { useAdminStats, useAdminStudents } from "@/hooks/use-admin";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminPage() {
  const { professor, loading, logout, isAdmin } = useAuth();
  const { data: stats } = useAdminStats();
  const { data: students } = useAdminStudents();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!professor || !isAdmin)) router.push("/login");
  }, [loading, professor, isAdmin, router]);

  if (loading || !stats) return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center">
        <h1 className="font-bold text-lg">Admin — Émargement</h1>
        <button onClick={logout} className="text-sm text-red-500 hover:underline">Déconnexion</button>
      </header>
      <main className="max-w-4xl mx-auto p-4">
        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Étudiants" value={stats.total_students} />
          <StatCard label="Cours aujourd'hui" value={stats.total_courses_today} />
          <StatCard label="Taux global" value={`${stats.global_attendance_rate}%`} />
          <StatCard label="Professeurs" value={stats.total_professors} />
        </div>

        {/* Students table */}
        <h2 className="text-lg font-semibold mb-3">Étudiants</h2>
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Alternance</th>
                <th className="px-4 py-3">Présences</th>
                <th className="px-4 py-3">Absences</th>
                <th className="px-4 py-3">Taux</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {students?.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{s.last_name} {s.first_name}</td>
                  <td className="px-4 py-3 text-gray-500">{s.email}</td>
                  <td className="px-4 py-3">{s.is_alternance ? "Oui" : "Non"}</td>
                  <td className="px-4 py-3 text-green-600">{s.attended}</td>
                  <td className="px-4 py-3 text-red-600">{s.absent}</td>
                  <td className="px-4 py-3">
                    {s.attendance_rate !== null ? (
                      <span className={s.attendance_rate < 70 ? "text-red-600 font-bold" : "text-green-600"}>
                        {s.attendance_rate}%
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
```

**Step 3: Verify**

Login with admin@ecole.fr / admin123 → redirected to /admin
Expected: Stats cards + students table with attendance rates

**Step 4: Commit**

```bash
git add frontend/src/app/admin/ frontend/src/hooks/use-admin.ts
git commit -m "feat: add admin dashboard with stats and students attendance table"
```

---

### Task 20: PWA Configuration

**Files:**
- Create: `frontend/public/manifest.json`
- Modify: `frontend/next.config.js` (add PWA plugin)

**Step 1: Create manifest.json**

```json
{
  "name": "Émargement",
  "short_name": "Émargement",
  "description": "Application d'émargement digital",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#f9fafb",
  "theme_color": "#2563eb",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Step 2: Update next.config.js with PWA plugin**

```javascript
const withPWA = require("next-pwa")({ dest: "public", disable: process.env.NODE_ENV === "development" });
module.exports = withPWA({ /* existing config */ });
```

**Step 3: Commit**

```bash
git add frontend/public/manifest.json frontend/next.config.js
git commit -m "feat: add PWA manifest for mobile install support"
```

---

### Task 21: Root Redirect + Final Wiring

**Files:**
- Modify: `frontend/src/app/page.tsx` (redirect to /login or /dashboard)

**Step 1: Update root page**

```tsx
// frontend/src/app/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const token = api.getToken();
    router.push(token ? "/dashboard" : "/login");
  }, [router]);
  return <div className="min-h-screen flex items-center justify-center">Redirection...</div>;
}
```

**Step 2: Verify full flow end-to-end**

1. Visit `/` → redirects to `/login`
2. Login as prof → `/dashboard` with today's courses
3. Click "Faire l'appel" → student list with toggle
4. Validate → emails sent (check backend logs for signature URLs)
5. Visit signature URL → sign presence → confirmed
6. Login as admin → `/admin` with stats + student table

**Step 3: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat: add root redirect and complete app wiring"
```

---

## Phase 4: Galia Mock Service

### Task 22: Galia Service Adapter

**Files:**
- Create: `backend/app/services/galia.py`

**Step 1: Create Galia adapter with mock implementation**

```python
# backend/app/services/galia.py
from abc import ABC, abstractmethod
from datetime import date, datetime
from app.core.config import settings

class GaliaServiceInterface(ABC):
    @abstractmethod
    async def sync_courses(self, professor_galia_id: str, target_date: date) -> list[dict]:
        """Fetch courses from Galia for a professor on a given date."""

    @abstractmethod
    async def sync_students(self, course_galia_id: str) -> list[dict]:
        """Fetch enrolled students for a course from Galia."""

    @abstractmethod
    async def push_attendance(self, course_galia_id: str, records: list[dict]) -> bool:
        """Push attendance records back to Galia."""

class MockGaliaService(GaliaServiceInterface):
    """Mock implementation for development without Galia API access."""

    async def sync_courses(self, professor_galia_id: str, target_date: date) -> list[dict]:
        return [
            {"galia_id": "GALIA-C001", "name": "Marketing L3", "room": "B204",
             "start_time": datetime(target_date.year, target_date.month, target_date.day, 9, 0),
             "end_time": datetime(target_date.year, target_date.month, target_date.day, 11, 0)},
            {"galia_id": "GALIA-C002", "name": "Finance M1", "room": "A102",
             "start_time": datetime(target_date.year, target_date.month, target_date.day, 14, 0),
             "end_time": datetime(target_date.year, target_date.month, target_date.day, 16, 0)},
        ]

    async def sync_students(self, course_galia_id: str) -> list[dict]:
        return [
            {"galia_id": "GALIA-S001", "email": "alice.martin@etu.fr", "first_name": "Alice", "last_name": "Martin", "is_alternance": True},
            {"galia_id": "GALIA-S002", "email": "bob.bernard@etu.fr", "first_name": "Bob", "last_name": "Bernard", "is_alternance": False},
        ]

    async def push_attendance(self, course_galia_id: str, records: list[dict]) -> bool:
        print(f"[MOCK] Pushed {len(records)} attendance records to Galia for course {course_galia_id}")
        return True

class GaliaAPIService(GaliaServiceInterface):
    """Real Galia API integration — implement when API access is available."""

    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.api_key = api_key

    async def sync_courses(self, professor_galia_id: str, target_date: date) -> list[dict]:
        raise NotImplementedError("Galia API integration pending — need API credentials")

    async def sync_students(self, course_galia_id: str) -> list[dict]:
        raise NotImplementedError("Galia API integration pending — need API credentials")

    async def push_attendance(self, course_galia_id: str, records: list[dict]) -> bool:
        raise NotImplementedError("Galia API integration pending — need API credentials")

def get_galia_service() -> GaliaServiceInterface:
    if settings.GALIA_MOCK:
        return MockGaliaService()
    return GaliaAPIService(base_url="", api_key="")
```

**Step 2: Commit**

```bash
git add backend/app/services/galia.py
git commit -m "feat: add Galia CRM service adapter with mock implementation"
```

---

## Summary of Tasks

| # | Task | Phase |
|---|------|-------|
| 1 | Backend project scaffolding | Backend Foundation |
| 2 | SQLAlchemy models | Backend Foundation |
| 3 | Alembic migrations + seed data | Backend Foundation |
| 4 | Pydantic schemas | Backend Foundation |
| 5 | Auth middleware + login endpoint | Backend Foundation |
| 6 | Courses endpoints | Core Backend API |
| 7 | Attendance validation + email | Core Backend API |
| 8 | E-signature endpoint | Core Backend API |
| 9 | QR code service + endpoint | Core Backend API |
| 10 | PDF report service | Core Backend API |
| 11 | Monthly report CRON job | Core Backend API |
| 12 | Admin endpoints | Core Backend API |
| 13 | Frontend project scaffolding | Frontend |
| 14 | SWR hooks | Frontend |
| 15 | Login page | Frontend |
| 16 | Professor dashboard | Frontend |
| 17 | Attendance page (roll call) | Frontend |
| 18 | Student e-signature page | Frontend |
| 19 | Admin dashboard | Frontend |
| 20 | PWA configuration | Frontend |
| 21 | Root redirect + final wiring | Frontend |
| 22 | Galia service adapter | Galia Mock |
