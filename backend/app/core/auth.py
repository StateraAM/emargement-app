import uuid as uuid_mod
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.core.database import get_db
from app.models.professor import Professor
from app.models.student import Student
from app.models.student_contact import StudentContact

pwd_context = CryptContext(schemes=["bcrypt"])
security = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, user_type: str = "professor") -> str:
    to_encode = data.copy()
    to_encode["user_type"] = user_type
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRATION_MINUTES)
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


async def get_current_professor(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Professor:
    try:
        payload = jwt.decode(credentials.credentials, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_type = payload.get("user_type", "professor")
        if user_type != "professor":
            raise HTTPException(status_code=401, detail="Not a professor token")
        professor_id = payload.get("sub")
        if professor_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        professor_id = uuid_mod.UUID(professor_id)
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(Professor).where(Professor.id == professor_id))
    professor = result.scalar_one_or_none()
    if professor is None:
        raise HTTPException(status_code=401, detail="Professor not found")
    return professor


async def get_current_student(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Student:
    try:
        payload = jwt.decode(credentials.credentials, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_type = payload.get("user_type")
        if user_type != "student":
            raise HTTPException(status_code=401, detail="Not a student token")
        student_id = payload.get("sub")
        if student_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        student_id = uuid_mod.UUID(student_id)
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if student is None:
        raise HTTPException(status_code=401, detail="Student not found")
    return student


async def require_admin(professor: Professor = Depends(get_current_professor)) -> Professor:
    if professor.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return professor


async def get_current_external(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> StudentContact:
    try:
        payload = jwt.decode(credentials.credentials, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("user_type") != "external":
            raise HTTPException(status_code=403, detail="External access required")
        contact_id = payload.get("sub")
        if contact_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        contact_id = uuid_mod.UUID(contact_id)
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(StudentContact).where(StudentContact.id == contact_id))
    contact = result.scalar_one_or_none()
    if contact is None:
        raise HTTPException(status_code=401, detail="Contact not found")
    return contact
