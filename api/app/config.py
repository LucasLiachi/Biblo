import secrets
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Placeholders publicados em documentação antiga; nunca aceitos como senha real.
KNOWN_INSECURE_PASSWORDS = {"biblo_secret_pass", "biblo_dev_pass", "postgres", "changeme"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    BIBLO_ENV: str = "dev"
    LIBRARIES_ROOT: Path = Path("/bibliotecas")  # cada subpasta é uma biblioteca

    # Banco: guarda só índice, vetores e metadados (descartável, reconstruído do disco).
    DB_USER: str = "biblo"
    DB_PASSWORD: str
    DB_NAME: str = "biblo"
    DB_HOST: str = "biblo_postgres"
    DB_PORT: int = 5432

    # Gateway de chat OpenAI-compatível (LiteLLM do AILab ou Ollama /v1).
    LLM_BASE_URL: str = "http://ailab_litellm:4000/v1"
    LLM_API_KEY: str = ""
    LLM_TIMEOUT_SECONDS: float = 120.0

    # Embeddings: ollama | openai (LiteLLM /v1/embeddings) | none (só busca textual).
    EMBEDDING_PROVIDER: str = "ollama"
    EMBEDDING_BASE_URL: str = "http://host.docker.internal:11434"
    EMBEDDING_MODEL: str = "nomic-embed-text"
    EMBEDDING_DIM: int = 768

    MAX_UPLOAD_MB: int = 15
    MAX_DOCUMENT_MB: int = 5
    MAX_CHUNKS_PER_DOC: int = 100
    RAG_MAX_CONTEXT_TOKENS: int = 4000
    RAG_TOP_K: int = 8
    CHAT_RATE_LIMIT_PER_MINUTE: int = 10
    WATCHER_MODE: str = "auto"  # auto | inotify | polling

    # Origens e hosts aceitos (anti-CSRF e anti-DNS-rebinding).
    ALLOWED_HOSTS: list[str] = ["localhost", "127.0.0.1", "biblo_api"]
    ALLOWED_ORIGINS: list[str] = ["http://localhost:2010", "http://127.0.0.1:2010"]

    # Token local: cookie HttpOnly para o navegador, header X-Biblo-Token para scripts.
    SESSION_TOKEN: str = ""

    @field_validator("DB_PASSWORD")
    @classmethod
    def validate_db_password(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("DB_PASSWORD não pode ser vazio. Defina uma senha no .env")
        if v.strip() in KNOWN_INSECURE_PASSWORDS:
            raise ValueError("DB_PASSWORD usa um placeholder público. Gere uma senha nova no .env")
        return v

    @field_validator("SESSION_TOKEN")
    @classmethod
    def ensure_session_token(cls, v: str) -> str:
        return v or secrets.token_urlsafe(32)

    @property
    def is_dev(self) -> bool:
        return self.BIBLO_ENV == "dev"


settings = Settings()  # type: ignore[call-arg]
