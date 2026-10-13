from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app.middlewares.security import verify_session_token
from app.services import llm_settings
from app.services.embeddings import EmbeddingsClient, EmbeddingsUnavailable
from app.services.indexer import get_indexer
from app.services.llm_client import LLMGatewayClient, LLMUnavailable, chat_models, embedding_models

router = APIRouter(prefix="/api/settings", tags=["Configuração"], dependencies=[Depends(verify_session_token)])


class LLMSettingsPayload(BaseModel):
    base_url: str = Field(min_length=1, max_length=500)
    # None mantém o token salvo; "" remove; qualquer outro valor substitui.
    api_key: str | None = Field(None, max_length=2000)
    default_model: str = Field("", max_length=200)
    guide_prompt: str = Field("", max_length=llm_settings.MAX_GUIDE_PROMPT_CHARS)
    # None mantém a configuração atual de embeddings.
    embedding_provider: Literal["chat", "ollama", "none"] | None = None
    embedding_model: str | None = Field(None, max_length=200)

    @field_validator("base_url")
    @classmethod
    def http_url(cls, v: str) -> str:
        v = v.strip().rstrip("/")
        if not v.startswith(("http://", "https://")):
            raise ValueError("O endereço precisa começar com http:// ou https://")
        return v

    def merged(self) -> llm_settings.LLMSettings:
        current = llm_settings.load()
        return llm_settings.LLMSettings(
            base_url=self.base_url,
            api_key=current.api_key if self.api_key is None else self.api_key.strip(),
            default_model=self.default_model.strip(),
            guide_prompt=self.guide_prompt.strip(),
            embedding_provider=current.embedding_provider if self.embedding_provider is None else self.embedding_provider,
            embedding_model=current.embedding_model if self.embedding_model is None else self.embedding_model.strip(),
        )


@router.get("/llm")
async def get_llm_settings() -> dict[str, object]:
    return llm_settings.load().public()


@router.put("/llm")
async def save_llm_settings(payload: LLMSettingsPayload) -> dict[str, object]:
    before = llm_settings.load().embedding_runtime()
    new = payload.merged()
    llm_settings.save(new)
    llm_settings.apply(new)
    if new.embedding_runtime() != before and (indexer := get_indexer()):
        await indexer.embeddings_reconfigured()
    return new.public()


@router.post("/llm/test")
async def test_llm_settings(payload: LLMSettingsPayload) -> dict[str, list[str]]:
    """Testa endereço e token sem salvar: devolve os modelos de chat e de embedding que o servidor expõe."""
    candidate = payload.merged()
    try:
        models = await LLMGatewayClient(candidate.base_url, candidate.api_key).list_models()
    except LLMUnavailable as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    return {"models": chat_models(models), "embedding_models": embedding_models(models)}


@router.post("/embeddings/test")
async def test_embeddings(payload: LLMSettingsPayload) -> dict[str, object]:
    """Gera um vetor de teste com a configuração informada, sem salvar."""
    candidate = payload.merged()
    provider, base_url, model, api_key = candidate.embedding_runtime()
    if provider == "none":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Busca semântica desativada: escolha um provedor para testar.")
    client = EmbeddingsClient(provider=provider, base_url=base_url, model=model, api_key=api_key)
    try:
        [vector] = await client.embed(["teste de conexão do Biblo"])
    except EmbeddingsUnavailable as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    return {"dimensions": len(vector), "model": model}
