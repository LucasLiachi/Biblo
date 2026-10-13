"""Compatibilidade do cliente de chat com servidores que recusam campos extras."""

from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest
from openai import BadRequestError

from app.services.llm_client import LLMGatewayClient


class FakeStream:
    def __init__(self, tokens: list[str]) -> None:
        self.tokens = tokens

    def __aiter__(self) -> AsyncIterator[Any]:
        async def gen() -> AsyncIterator[Any]:
            for t in self.tokens:
                delta = type("D", (), {"content": t})()
                yield type("E", (), {"choices": [type("C", (), {"delta": delta})()]})()

        return gen()

    async def close(self) -> None:
        pass


def _bad_request(message: str) -> BadRequestError:
    request = httpx.Request("POST", "https://exemplo/v1/chat/completions")
    return BadRequestError(message, response=httpx.Response(400, request=request), body=None)


async def test_metadata_is_dropped_when_the_server_rejects_it(monkeypatch: pytest.MonkeyPatch) -> None:
    client = LLMGatewayClient("https://generativelanguage.googleapis.com/v1beta/openai", "k")
    calls: list[Any] = []

    async def create(**kwargs: Any) -> FakeStream:
        calls.append(kwargs.get("extra_body"))
        if kwargs.get("extra_body"):
            raise _bad_request('Invalid JSON payload received. Unknown name "metadata": Cannot find field.')
        return FakeStream(["Olá", "!"])

    monkeypatch.setattr(client._client.chat.completions, "create", create)
    tokens = [t async for t in client.stream_chat("m", [{"role": "user", "content": "oi"}], {"tags": ["biblo"]})]
    assert tokens == ["Olá", "!"]
    assert calls == [{"metadata": {"tags": ["biblo"]}}, None]
    assert client.send_metadata is False

    calls.clear()
    _ = [t async for t in client.stream_chat("m", [{"role": "user", "content": "oi"}], {"tags": ["biblo"]})]
    assert calls == [None]  # a decisão vale para as próximas chamadas

    client.configure("http://outro/v1", "")
    assert client.send_metadata is True  # outro servidor: tenta de novo com metadata


async def test_other_bad_requests_are_reported(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.llm_client import LLMUnavailable

    client = LLMGatewayClient("http://x/v1", "")

    async def create(**kwargs: Any) -> FakeStream:
        raise _bad_request("model not found")

    monkeypatch.setattr(client._client.chat.completions, "create", create)
    with pytest.raises(LLMUnavailable, match="model not found"):
        _ = [t async for t in client.stream_chat("m", [{"role": "user", "content": "oi"}])]
