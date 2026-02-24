import uuid as uuid_mod
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.config import settings
from app.core.auth import verify_password, create_access_token, get_current_professor
from app.core.rate_limit import limiter
from app.models.professor import Professor
from app.models.student import Student
from app.models.student_contact import StudentContact
from app.schemas.auth import LoginRequest, TokenResponse, ProfessorResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, login_data: LoginRequest, db: AsyncSession = Depends(get_db)):
    # Try professor first
    result = await db.execute(select(Professor).where(Professor.email == login_data.email))
    professor = result.scalar_one_or_none()
    if professor and verify_password(login_data.password, professor.password_hash):
        token = create_access_token({"sub": str(professor.id), "role": professor.role}, user_type="professor")
        return TokenResponse(access_token=token)

    # Try student
    result = await db.execute(select(Student).where(Student.email == login_data.email))
    student = result.scalar_one_or_none()
    if student and student.password_hash and verify_password(login_data.password, student.password_hash):
        token = create_access_token({"sub": str(student.id)}, user_type="student")
        return TokenResponse(access_token=token)

    # Try external (student contact) login
    contact_result = await db.execute(select(StudentContact).where(StudentContact.email == login_data.email))
    contact = contact_result.scalar_one_or_none()
    if contact and contact.password_hash and verify_password(login_data.password, contact.password_hash):
        token = create_access_token({"sub": str(contact.id)}, user_type="external")
        return TokenResponse(access_token=token)

    raise HTTPException(status_code=401, detail="Invalid email or password")


@router.get("/me", response_model=UserResponse)
async def get_me(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    try:
        payload = jwt.decode(credentials.credentials, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_type = payload.get("user_type", "professor")
        user_id = payload.get("sub")
        user_uuid = uuid_mod.UUID(user_id)
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")

    if user_type == "student":
        result = await db.execute(select(Student).where(Student.id == user_uuid))
        student = result.scalar_one_or_none()
        if not student:
            raise HTTPException(status_code=401, detail="Student not found")
        return UserResponse(
            id=str(student.id), email=student.email,
            first_name=student.first_name, last_name=student.last_name,
            user_type="student",
        )
    elif user_type == "external":
        result = await db.execute(select(StudentContact).where(StudentContact.id == user_uuid))
        contact = result.scalar_one_or_none()
        if not contact:
            raise HTTPException(status_code=401, detail="Contact not found")
        return UserResponse(
            id=str(contact.id), email=contact.email,
            first_name=contact.first_name, last_name=contact.last_name,
            user_type="external",
        )
    else:
        result = await db.execute(select(Professor).where(Professor.id == user_uuid))
        professor = result.scalar_one_or_none()
        if not professor:
            raise HTTPException(status_code=401, detail="Professor not found")
        return UserResponse(
            id=str(professor.id), email=professor.email,
            first_name=professor.first_name, last_name=professor.last_name,
            user_type="professor", role=professor.role,
        )
