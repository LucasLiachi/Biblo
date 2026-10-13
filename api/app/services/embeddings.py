"""Cliente de embeddings (Ollama nativo ou endpoint OpenAI-compatível), configurável em tempo de execução."""

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
        self.dim = dim
        self.last_error: str | None = None
        self.configure(provider, base_url, model, api_key)

    def configure(self, provider: str, base_url: str, model: str, api_key: str) -> None:
        self.provider = provider
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key = api_key
        self.last_error = None
        # Pede vetores no tamanho do índice (Gemini e OpenAI text-embedding-3 aceitam); quem recusar recebe sem o campo.
        self.send_dimensions = True

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
                    body: dict[str, object] = {"model": self.model, "input": inputs}
                    if self.send_dimensions:
                        body["dimensions"] = self.dim
                    res = await client.post(f"{self.base_url}/embeddings", json=body, headers=headers)
                    if res.status_code == 400 and self.send_dimensions and "dimension" in res.text.lower():
                        self.send_dimensions = False
                        body.pop("dimensions")
                        res = await client.post(f"{self.base_url}/embeddings", json=body, headers=headers)
                    res.raise_for_status()
                    # O Gemini omite "index" quando vale 0; sem o campo, vale a posição na lista.
                    data = list(enumerate(res.json()["data"]))
                    vectors = [item["embedding"] for _, item in sorted(data, key=lambda p: p[1].get("index", p[0]))]
                else:
                    raise EmbeddingsUnavailable(f"EMBEDDING_PROVIDER desconhecido: {self.provider}")
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            detail = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else exc.__class__.__name__
            self.last_error = f"{self.model_id} indisponível em {self.base_url}: {detail}"
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
