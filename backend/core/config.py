from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Pulse API"
    app_version: str = "0.1.0"
    debug: bool = False

    # Database — auto-normalize postgresql:// → postgresql+asyncpg://
    database_url: str = ""

    @property
    def async_database_url(self) -> str:
        url = self.database_url
        if url.startswith("postgresql://") or url.startswith("postgres://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url

    # Clerk
    clerk_secret_key: str = ""
    clerk_jwks_url: str = ""

    # DeepSeek (OpenAI-compatible)
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com/v1"

    # Pinecone
    pinecone_api_key: str = ""
    pinecone_index_name: str = "pulse-articles"

    # Serper (Google News)
    serper_api_key: str = ""

    # Resend
    resend_api_key: str = ""
    resend_from_email: str = "digest@pulse.ai"

    # CORS — comma-separated list of allowed origins
    allowed_origins: str = "http://localhost:3000"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
