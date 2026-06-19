from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Pulse API"
    app_version: str = "0.1.0"
    debug: bool = False

    # Database
    database_url: str = ""

    # Clerk
    clerk_secret_key: str = ""
    clerk_jwks_url: str = ""

    # DeepSeek (OpenAI-compatible)
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com/v1"

    # Pinecone
    pinecone_api_key: str = ""
    pinecone_index_name: str = "pulse-articles"

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
