from typing import Optional
from pydantic import BaseModel


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


class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    user_type: str
    role: Optional[str] = None

    class Config:
        from_attributes = True
