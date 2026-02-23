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
