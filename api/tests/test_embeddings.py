"""Cliente de embeddings OpenAI-compatível: dimensão pedida e servidores que recusam o campo."""

import json
from typing import Any

import httpx
import pytest

from app.services import embeddings as embeddings_module
from app.services.embeddings import EmbeddingsClient
from app.services.llm_client import chat_models, embedding_models


def _patch_transport(monkeypatch: pytest.MonkeyPatch, handler: Any) -> None:
    real = httpx.AsyncClient

    def factory(*args: Any, **kwargs: Any) -> httpx.AsyncClient:
        return real(*args, transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(embeddings_module.httpx, "AsyncClient", factory)


async def test_requests_vectors_in_the_index_dimension(monkeypatch: pytest.MonkeyPatch) -> None:
    bodies: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        bodies.append(json.loads(request.content))
        assert request.headers["authorization"] == "Bearer k"
        return httpx.Response(200, json={"data": [{"index": 0, "embedding": [0.1] * 768}]})

    _patch_transport(monkeypatch, handler)
    client = EmbeddingsClient(provider="openai", base_url="https://g/v1", model="models/gemini-embedding-001", api_key="k")
    [vector] = await client.embed(["oi"])
    assert len(vector) == 768 and bodies[0]["dimensions"] == 768


async def test_dimensions_field_is_dropped_when_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    bodies: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        bodies.append(body)
        if "dimensions" in body:
            return httpx.Response(400, json={"error": "Unknown parameter: dimensions"})
        return httpx.Response(200, json={"data": [{"index": 0, "embedding": [0.1] * 768}]})

    _patch_transport(monkeypatch, handler)
    client = EmbeddingsClient(provider="openai", base_url="http://x/v1", model="m", api_key="")
    await client.embed(["oi"])
    await client.embed(["de novo"])
    assert ["dimensions" in b for b in bodies] == [True, False, False]


def test_model_lists_are_split_between_chat_and_embeddings() -> None:
    raw = [
        "models/gemini-3.5-flash",
        "models/gemini-embedding-001",
        "models/gemini-2.5-flash-preview-tts",
        "models/veo-3.1-generate-preview",
        "models/antigravity-preview-05-2026",
        "models/gemini-3.1-flash-image",
        "models/gemma-4-31b-it",
        "gpt-4o",
    ]
    assert chat_models(raw) == ["models/gemini-3.5-flash", "models/gemma-4-31b-it", "gpt-4o"]
    assert embedding_models(raw) == ["models/gemini-embedding-001"]


async def test_missing_index_in_response_is_tolerated(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        # Formato real do Gemini: o primeiro item vem sem "index".
        data = [{"object": "embedding", "embedding": [0.0] * 768}, {"object": "embedding", "index": 1, "embedding": [1.0] * 768}]
        return httpx.Response(200, json={"object": "list", "data": data})

    _patch_transport(monkeypatch, handler)
    client = EmbeddingsClient(provider="openai", base_url="https://g/v1", model="m", api_key="k")
    first, second = await client.embed(["a", "b"])
    assert first[0] == 0.0 and second[0] == 1.0
