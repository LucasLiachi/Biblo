import json
import time
from collections.abc import AsyncIterator
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.db import pool
from app.middlewares.security import verify_session_token
from app.services.embeddings import embeddings_client
from app.services.llm_client import LLMUnavailable, llm_gateway
from app.services.rag import build_chat_messages, hybrid_search

router = APIRouter(prefix="/api", tags=["Chat"], dependencies=[Depends(verify_session_token)])

_recent_requests: list[float] = []


def enforce_rate_limit(max_per_minute: int = settings.CHAT_RATE_LIMIT_PER_MINUTE) -> None:
    """Janela deslizante de 60 s. O Biblo é monousuário, então o limite é global."""
    now = time.monotonic()
    _recent_requests[:] = [t for t in _recent_requests if now - t < 60]
    if len(_recent_requests) >= max_per_minute:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, f"Limite de {max_per_minute} mensagens por minuto atingido.")
    _recent_requests.append(now)


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=20_000)


class ChatPayload(BaseModel):
    model: str = Field(min_length=1, max_length=200)
    messages: list[ChatTurn] = Field(min_length=1, max_length=40)


@router.get("/models")
async def list_models() -> dict[str, list[str]]:
    try:
        return {"models": await llm_gateway.list_models()}
    except LLMUnavailable as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc


def _sse(event: str, data: object) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/chat/stream")
async def chat_stream(payload: ChatPayload, request: Request) -> StreamingResponse:
    enforce_rate_limit()
    if payload.messages[-1].role != "user":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A última mensagem precisa ser do usuário.")
    if (db := pool()) is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Índice indisponível: o banco não está conectado.")

    question = payload.messages[-1].content
    async with db.acquire() as conn:
        hits, mode = await hybrid_search(conn, question, embeddings_client, limit=settings.RAG_TOP_K)
    history = [m.model_dump() for m in payload.messages]
    messages, used = build_chat_messages(history, hits, settings.RAG_MAX_CONTEXT_TOKENS)

    async def events() -> AsyncIterator[str]:
        yield _sse("citations", {"mode": mode, "citations": [h.citation() for h in used]})
        try:
            async for token in llm_gateway.stream_chat(
                payload.model, messages, metadata={"tags": ["biblo", "rag"], "trace_user_id": "biblo_local_user"}
            ):
                if await request.is_disconnected():
                    break  # cliente saiu: encerrar o stream também encerra a chamada ao provedor
                yield _sse("token", {"t": token})
        except LLMUnavailable as exc:
            yield _sse("error", {"message": str(exc)})
        yield _sse("done", {})

    return StreamingResponse(
        events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )
