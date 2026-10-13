"""Configuração da LLM do chat, editável pela interface.

Fica em `<LIBRARIES_ROOT>/.biblo/settings.json` (pasta oculta: fora da árvore e do índice), com permissão 0600.
Valores ausentes no arquivo caem nas variáveis de ambiente (`LLM_BASE_URL`, `LLM_API_KEY`, `EMBEDDING_*`).
O token nunca sai da API: a leitura informa só se ele está definido.
"""

import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from app.config import settings

MAX_GUIDE_PROMPT_CHARS = 4000
EMBEDDING_PROVIDERS = ("chat", "ollama", "none")  # "chat": mesmo servidor e token do chat (API compatível com OpenAI)


@dataclass
class LLMSettings:
    base_url: str
    api_key: str
    default_model: str
    guide_prompt: str
    embedding_provider: str
    embedding_model: str

    def public(self) -> dict[str, Any]:
        return {
            "base_url": self.base_url,
            "has_api_key": bool(self.api_key),
            "default_model": self.default_model,
            "guide_prompt": self.guide_prompt,
            "embedding_provider": self.embedding_provider,
            "embedding_model": self.embedding_model,
            "embedding_dim": settings.EMBEDDING_DIM,
        }

    def embedding_runtime(self) -> tuple[str, str, str, str]:
        """(provider do cliente, endereço, modelo, token) para o EmbeddingsClient."""
        if self.embedding_provider == "chat":
            return "openai", self.base_url, self.embedding_model, self.api_key
        if self.embedding_provider == "ollama":
            return "ollama", settings.EMBEDDING_BASE_URL, self.embedding_model, ""
        return "none", "", self.embedding_model, ""


def settings_file() -> Path:
    return settings.LIBRARIES_ROOT / ".biblo" / "settings.json"


def _read_file() -> dict[str, Any]:
    try:
        data = json.loads(settings_file().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data.get("llm", {}) if isinstance(data, dict) else {}


def load() -> LLMSettings:
    stored = _read_file()
    return LLMSettings(
        base_url=str(stored.get("base_url") or settings.LLM_BASE_URL),
        api_key=str(stored["api_key"]) if "api_key" in stored else settings.LLM_API_KEY,
        default_model=str(stored.get("default_model") or ""),
        guide_prompt=str(stored.get("guide_prompt") or ""),
        embedding_provider=str(stored.get("embedding_provider") or _env_embedding_provider()),
        embedding_model=str(stored.get("embedding_model") or settings.EMBEDDING_MODEL),
    )


def _env_embedding_provider() -> str:
    return {"openai": "chat", "ollama": "ollama"}.get(settings.EMBEDDING_PROVIDER, "none")


def apply(current: LLMSettings) -> None:
    """Reconfigura os clientes de chat e de embeddings com a configuração vigente."""
    from app.services.embeddings import embeddings_client
    from app.services.llm_client import llm_gateway

    llm_gateway.configure(current.base_url, current.api_key)
    embeddings_client.configure(*current.embedding_runtime())


def save(new: LLMSettings) -> None:
    path = settings_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(document, dict):
            document = {}
    except (OSError, ValueError):
        document = {}
    document["llm"] = asdict(new)
    temp = path.with_suffix(".tmp")
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(document, f, ensure_ascii=False, indent=2)
    os.replace(temp, path)
    os.chmod(path, 0o600)
