"""Cliente de chat OpenAI-compatível (LiteLLM do AILab ou Ollama /v1)."""

from collections.abc import AsyncIterator
from typing import Any

from openai import APIError, AsyncOpenAI

from app.config import settings


class LLMUnavailable(RuntimeError):
    pass


class LLMGatewayClient:
    def __init__(self, base_url: str = settings.LLM_BASE_URL, api_key: str = settings.LLM_API_KEY) -> None:
        self.base_url = base_url
        self._client = AsyncOpenAI(
            base_url=base_url, api_key=api_key or "sem-chave", timeout=settings.LLM_TIMEOUT_SECONDS, max_retries=0
        )

    async def list_models(self) -> list[str]:
        try:
            page = await self._client.models.list()
        except (APIError, OSError) as exc:
            raise LLMUnavailable(f"Gateway de LLM indisponível em {self.base_url}") from exc
        except Exception as exc:  # httpx.ConnectError chega embrulhado de formas diferentes
            raise LLMUnavailable(f"Gateway de LLM indisponível em {self.base_url}") from exc
        return sorted(m.id for m in page.data)

    async def stream_chat(
        self, model: str, messages: list[dict[str, str]], metadata: dict[str, Any] | None = None
    ) -> AsyncIterator[str]:
        try:
            stream = await self._client.chat.completions.create(
                model=model,
                messages=messages,  # type: ignore[arg-type]
                stream=True,
                temperature=0.2,
                max_tokens=2048,
                extra_body={"metadata": metadata or {}},
            )
        except Exception as exc:
            raise LLMUnavailable(f"Falha ao chamar o modelo '{model}' em {self.base_url}: {exc}") from exc
        try:
            async for event in stream:
                if event.choices and (delta := event.choices[0].delta.content):
                    yield delta
        finally:
            await stream.close()


llm_gateway = LLMGatewayClient()
