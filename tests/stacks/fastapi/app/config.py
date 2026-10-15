from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # postgresql+asyncpg://user:password@host:5432/db, from the DATABASE_URL environment variable
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/app"


settings = Settings()
