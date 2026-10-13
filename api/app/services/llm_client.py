"""Cliente de chat OpenAI-compatível (LiteLLM, Ollama /v1, OpenAI e afins), configurável em tempo de execução."""

import re
from collections.abc import AsyncIterator
from typing import Any

from openai import APIError, AsyncOpenAI, AuthenticationError, BadRequestError

from app.config import settings


class LLMUnavailable(RuntimeError):
    pass


# Modelos que o /models de provedores como o Google lista, mas que não conversam por chat/completions:
# embeddings, imagem, áudio/voz, vídeo, música, tempo real, robótica e agentes de outras APIs.
NON_CHAT_MODEL = re.compile(
    r"embed|aqa|image|imagen|tts|audio|live|transcribe|translate|veo|lyria|nano-banana|robotics|"
    r"computer-use|deep-research|customtools|antigravity|moderation|whisper|dall-e|rerank",
    re.IGNORECASE,
)


def chat_models(models: list[str]) -> list[str]:
    return [m for m in models if not NON_CHAT_MODEL.search(m)]


def embedding_models(models: list[str]) -> list[str]:
    return [m for m in models if "embed" in m.lower()]


class LLMGatewayClient:
    def __init__(self, base_url: str = settings.LLM_BASE_URL, api_key: str = settings.LLM_API_KEY) -> None:
        self.configure(base_url, api_key)

    def configure(self, base_url: str, api_key: str) -> None:
        """Troca endereço e token (configuração salva pela interface)."""
        self.base_url = base_url
        # metadata (tags de rastreamento) é extensão do LiteLLM/Langfuse. Servidores estritos, como o endpoint
        # OpenAI-compatível do Gemini, recusam o campo; na primeira recusa ele deixa de ser enviado.
        self.send_metadata = True
        self._client = AsyncOpenAI(
            base_url=base_url,
            api_key=api_key or "sem-chave",
            timeout=settings.LLM_TIMEOUT_SECONDS,
            max_retries=2,  # 429/5xx (ex.: "alta demanda" do Gemini) são tentados de novo com espera crescente
        )

    async def list_models(self) -> list[str]:
        try:
            page = await self._client.models.list()
        except AuthenticationError as exc:
            raise LLMUnavailable(f"Token recusado por {self.base_url}") from exc
        except (APIError, OSError) as exc:
            raise LLMUnavailable(f"Gateway de LLM indisponível em {self.base_url}") from exc
        except Exception as exc:  # httpx.ConnectError chega embrulhado de formas diferentes
            raise LLMUnavailable(f"Gateway de LLM indisponível em {self.base_url}") from exc
        return sorted(m.id for m in page.data)

    async def stream_chat(
        self, model: str, messages: list[dict[str, str]], metadata: dict[str, Any] | None = None
    ) -> AsyncIterator[str]:
        try:
            try:
                stream = await self._create(model, messages, metadata)
            except BadRequestError as exc:
                if not (self.send_metadata and "metadata" in str(exc)):
                    raise
                self.send_metadata = False
                stream = await self._create(model, messages, metadata)
        except Exception as exc:
            raise LLMUnavailable(f"Falha ao chamar o modelo '{model}' em {self.base_url}: {exc}") from exc
        try:
            async for event in stream:
                if event.choices and (delta := event.choices[0].delta.content):
                    yield delta
        finally:
            await stream.close()


    async def _create(self, model: str, messages: list[dict[str, str]], metadata: dict[str, Any] | None):  # type: ignore[no-untyped-def]
        extra = {"metadata": metadata or {}} if self.send_metadata else None
        return await self._client.chat.completions.create(
            model=model,
            messages=messages,  # type: ignore[arg-type]
            stream=True,
            temperature=0.2,
            max_tokens=4096,  # modelos com raciocínio (ex.: Gemini 2.5) gastam parte disso antes de responder
            extra_body=extra,
        )


llm_gateway = LLMGatewayClient()
