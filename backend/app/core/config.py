from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+psycopg://sbos:sbos@localhost:5432/sbos"
    TEST_DATABASE_URL: str = "postgresql+psycopg://sbos:sbos@localhost:5432/sbos_test"
    SUPABASE_URL: str = ""
    SUPABASE_JWT_SECRET: str = "dev-jwt-secret-change-me"
    CORS_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
