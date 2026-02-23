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
