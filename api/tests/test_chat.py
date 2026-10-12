"""Chat RAG com LLM e busca simulados: nunca chama provedor real."""

import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import httpx
import pytest

from app.config import settings
from app.main import app
from app.routers import chat as chat_module
from app.services.llm_client import LLMUnavailable
from app.services.rag import SearchHit

HEADERS = {"X-Biblo-Token": settings.SESSION_TOKEN, "Content-Type": "application/json"}


class FakePool:
    @asynccontextmanager
    async def acquire(self) -> AsyncIterator[None]:
        yield None


def _parse_sse(body: str) -> list[tuple[str, Any]]:
    events = []
    for block in body.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        events.append((lines["event"], json.loads(lines["data"])))
    return events


@pytest.fixture(autouse=True)
def fakes(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    captured: dict[str, Any] = {}
    chat_module._recent_requests.clear()

    async def fake_search(conn: Any, query: str, embedder: Any, limit: int = 8) -> tuple[list[SearchHit], str]:
        captured["query"] = query
        return [SearchHit(1, "notas/arch.md", "Arch", "markdown", "Intro", 1, 4, "O vault é a fonte da verdade.", 0.03)], "text"

    async def fake_stream(model: str, messages: list[dict[str, str]], metadata: Any = None) -> AsyncIterator[str]:
        captured["model"] = model
        captured["messages"] = messages
        for token in ["O vault ", "manda. ", "[notas/arch.md]"]:
            yield token

    monkeypatch.setattr(chat_module, "pool", lambda: FakePool())
    monkeypatch.setattr(chat_module, "hybrid_search", fake_search)
    monkeypatch.setattr(chat_module.llm_gateway, "stream_chat", fake_stream)
    return captured


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://localhost") as c:
        yield c


async def test_stream_sends_citations_tokens_and_done(client: httpx.AsyncClient, fakes: dict[str, Any]) -> None:
    payload = {"model": "claude-teste", "messages": [{"role": "user", "content": "Qual a fonte da verdade?"}]}
    res = await client.post("/api/chat/stream", json=payload, headers=HEADERS)
    assert res.status_code == 200
    events = _parse_sse(res.text)
    assert events[0][0] == "citations"
    assert events[0][1]["citations"][0]["path"] == "notas/arch.md"
    assert "".join(e[1]["t"] for e in events if e[0] == "token") == "O vault manda. [notas/arch.md]"
    assert events[-1][0] == "done"
    assert fakes["model"] == "claude-teste"
    assert fakes["query"] == "Qual a fonte da verdade?"


async def test_llm_failure_is_reported_not_faked(client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def broken(model: str, messages: Any, metadata: Any = None) -> AsyncIterator[str]:
        raise LLMUnavailable("Gateway de LLM indisponível em http://x")
        yield ""  # pragma: no cover

    monkeypatch.setattr(chat_module.llm_gateway, "stream_chat", broken)
    payload = {"model": "m", "messages": [{"role": "user", "content": "oi"}]}
    events = _parse_sse((await client.post("/api/chat/stream", json=payload, headers=HEADERS)).text)
    assert ("error", {"message": "Gateway de LLM indisponível em http://x"}) in events
    assert not [e for e in events if e[0] == "token"]


async def test_last_message_must_be_from_user(client: httpx.AsyncClient) -> None:
    payload = {"model": "m", "messages": [{"role": "assistant", "content": "oi"}]}
    assert (await client.post("/api/chat/stream", json=payload, headers=HEADERS)).status_code == 400


async def test_rate_limit_returns_429(client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    payload = {"model": "m", "messages": [{"role": "user", "content": "oi"}]}
    for _ in range(settings.CHAT_RATE_LIMIT_PER_MINUTE):
        assert (await client.post("/api/chat/stream", json=payload, headers=HEADERS)).status_code == 200
    assert (await client.post("/api/chat/stream", json=payload, headers=HEADERS)).status_code == 429


async def test_models_unavailable_returns_503(client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def down() -> list[str]:
        raise LLMUnavailable("Gateway de LLM indisponível em http://x")

    monkeypatch.setattr(chat_module.llm_gateway, "list_models", down)
    res = await client.get("/api/models", headers=HEADERS)
    assert res.status_code == 503 and "indisponível" in res.json()["detail"]
