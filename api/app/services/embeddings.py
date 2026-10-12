"""Cliente de embeddings (Ollama nativo ou endpoint OpenAI-compatível do LiteLLM)."""

import httpx

from app.config import settings


class EmbeddingsUnavailable(RuntimeError):
    pass


class EmbeddingsClient:
    def __init__(
        self,
        provider: str = settings.EMBEDDING_PROVIDER,
        base_url: str = settings.EMBEDDING_BASE_URL,
        model: str = settings.EMBEDDING_MODEL,
        dim: int = settings.EMBEDDING_DIM,
        api_key: str = settings.LLM_API_KEY,
    ) -> None:
        self.provider = provider
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.dim = dim
        self.api_key = api_key
        self.last_error: str | None = None

    @property
    def enabled(self) -> bool:
        return self.provider != "none"

    @property
    def model_id(self) -> str:
        return f"{self.provider}:{self.model}"

    def _prefix(self, kind: str) -> str:
        # Modelos nomic foram treinados com prefixos de tarefa.
        if "nomic" in self.model:
            return "search_query: " if kind == "query" else "search_document: "
        return ""

    async def embed(self, texts: list[str], kind: str = "document") -> list[list[float]]:
        if not self.enabled:
            raise EmbeddingsUnavailable("Embeddings desativados (EMBEDDING_PROVIDER=none).")
        if not texts:
            return []
        inputs = [self._prefix(kind) + t for t in texts]
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                if self.provider == "ollama":
                    res = await client.post(f"{self.base_url}/api/embed", json={"model": self.model, "input": inputs})
                    res.raise_for_status()
                    vectors = res.json()["embeddings"]
                elif self.provider == "openai":
                    headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
                    res = await client.post(
                        f"{self.base_url}/embeddings", json={"model": self.model, "input": inputs}, headers=headers
                    )
                    res.raise_for_status()
                    vectors = [item["embedding"] for item in sorted(res.json()["data"], key=lambda d: d["index"])]
                else:
                    raise EmbeddingsUnavailable(f"EMBEDDING_PROVIDER desconhecido: {self.provider}")
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            self.last_error = f"{self.model_id} indisponível em {self.base_url}: {exc.__class__.__name__}"
            raise EmbeddingsUnavailable(self.last_error) from exc

        for vector in vectors:
            if len(vector) != self.dim:
                self.last_error = (
                    f"{self.model_id} devolveu {len(vector)} dimensões, mas EMBEDDING_DIM={self.dim}. "
                    "Ajuste o modelo ou o schema."
                )
                raise EmbeddingsUnavailable(self.last_error)
        self.last_error = None
        return vectors


embeddings_client = EmbeddingsClient()
