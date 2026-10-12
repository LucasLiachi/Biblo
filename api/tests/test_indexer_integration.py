"""Indexador + busca contra PostgreSQL real com pgvector.

Roda com BIBLO_TEST_DB=1 (ver README § Testes); usa um database próprio, `biblo_test`.
"""

import os
from collections.abc import AsyncIterator
from pathlib import Path

import asyncpg
import pytest

from app import db
from app.config import settings
from app.services.embeddings import EmbeddingsClient
from app.services.indexer import Indexer
from app.services.rag import hybrid_search

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(os.environ.get("BIBLO_TEST_DB") != "1", reason="defina BIBLO_TEST_DB=1 com Postgres acessível"),
]

TEST_DB = "biblo_test"


class FakeEmbedder(EmbeddingsClient):
    """Vetores determinísticos: 1.0 na dimensão do hash de cada palavra."""

    def __init__(self, model: str = "fake-v1") -> None:
        super().__init__(provider="fake", base_url="", model=model, dim=768)

    async def embed(self, texts: list[str], kind: str = "document") -> list[list[float]]:
        vectors = []
        for text in texts:
            v = [0.0] * 768
            for word in text.lower().split():
                v[hash(word) % 768] += 1.0
            v[0] += 0.001
            vectors.append(v)
        return vectors


@pytest.fixture
async def pool() -> AsyncIterator[asyncpg.Pool]:
    admin = await asyncpg.connect(
        user=settings.DB_USER, password=settings.DB_PASSWORD, host=settings.DB_HOST, port=settings.DB_PORT, database="postgres"
    )
    await admin.execute(f"DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE)")
    await admin.execute(f"CREATE DATABASE {TEST_DB}")
    await admin.close()
    p = await asyncpg.create_pool(
        user=settings.DB_USER, password=settings.DB_PASSWORD, host=settings.DB_HOST, port=settings.DB_PORT, database=TEST_DB
    )
    async with p.acquire() as conn:
        assert await db.ensure_schema(conn) is True
        assert await db.ensure_schema(conn) is False  # idempotente
    yield p
    await p.close()


@pytest.fixture
def vault(tmp_path: Path) -> Path:
    root = tmp_path / "vault"
    (root / "notas").mkdir(parents=True)
    (root / "notas" / "config.md").write_text("# Configuração\nA configuração do gateway fica no .env.\n", encoding="utf-8")
    (root / "notas" / "indice.md").write_text("# Índice\nComece por [[config]] e [[inexistente]].\n", encoding="utf-8")
    return root


async def test_reconcile_indexes_and_search_ignores_accents(pool: asyncpg.Pool, vault: Path) -> None:
    indexer = Indexer(vault, pool, FakeEmbedder())
    result = await indexer.reconcile()
    assert result == {"scanned": 2, "reindexed": 2, "removed": 0}

    async with pool.acquire() as conn:
        hits, mode = await hybrid_search(conn, "configuracao", indexer.embedder, limit=5)
    assert mode == "hybrid"
    assert hits[0].path == "notas/config.md"
    assert hits[0].start_line == 1


async def test_reconcile_is_incremental_and_removes_orphans(pool: asyncpg.Pool, vault: Path) -> None:
    indexer = Indexer(vault, pool, FakeEmbedder())
    await indexer.reconcile()
    assert (await indexer.reconcile())["reindexed"] == 0

    (vault / "notas" / "indice.md").unlink()
    (vault / "notas" / "nova.md").write_text("# Nova\ncriada com a API parada", encoding="utf-8")
    result = await indexer.reconcile()
    assert result == {"scanned": 2, "reindexed": 1, "removed": 1}


async def test_links_are_stored_for_backlinks(pool: asyncpg.Pool, vault: Path) -> None:
    await Indexer(vault, pool, FakeEmbedder()).reconcile()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT d.path, l.target_key FROM links l JOIN documents d ON d.id = l.source_id ORDER BY 2"
        )
    assert [(r["path"], r["target_key"]) for r in rows] == [("notas/indice.md", "config"), ("notas/indice.md", "inexistente")]


async def test_changing_embedding_model_invalidates_old_vectors(pool: asyncpg.Pool, vault: Path) -> None:
    first = Indexer(vault, pool, FakeEmbedder("fake-v1"))
    await first.check_embedding_space()
    await first.reconcile()

    second = Indexer(vault, pool, FakeEmbedder("fake-v2"))
    await second.check_embedding_space()
    await second.refresh_counts()
    assert second.state.chunks_without_embedding == second.state.total_chunks > 0

    assert await second.backfill_embeddings() == second.state.total_chunks
    async with pool.acquire() as conn:
        models = {r["embedding_model"] for r in await conn.fetch("SELECT embedding_model FROM chunks")}
    assert models == {"fake:fake-v2"}


async def test_without_embeddings_search_falls_back_to_text(pool: asyncpg.Pool, vault: Path) -> None:
    indexer = Indexer(vault, pool, EmbeddingsClient(provider="none"))
    await indexer.reconcile()
    async with pool.acquire() as conn:
        hits, mode = await hybrid_search(conn, "gateway", indexer.embedder)
    assert mode == "text" and hits[0].path == "notas/config.md"


async def test_natural_language_question_matches_any_term(pool: asyncpg.Pool, vault: Path) -> None:
    indexer = Indexer(vault, pool, EmbeddingsClient(provider="none"))
    await indexer.reconcile()
    async with pool.acquire() as conn:
        hits, _ = await hybrid_search(conn, "Como funciona a configuração?", indexer.embedder)
        empty, _ = await hybrid_search(conn, "como a de", indexer.embedder)  # só stopwords
    assert hits and hits[0].path == "notas/config.md"
    assert empty == []
