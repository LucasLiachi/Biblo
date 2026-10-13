"""Pool do PostgreSQL e schema do índice.

O banco é descartável: guarda só o índice derivado das bibliotecas. Quando a versão do
schema muda, as tabelas são recriadas e o indexador reconstrói tudo a partir do disco.
"""

from pathlib import Path

import asyncpg

from app.config import settings

# Suba também quando o parser mudar o que é extraído (chunks, títulos, links): força reindexação completa.
SCHEMA_VERSION = 3
SCHEMA_FILE = Path(__file__).parent / "schema.sql"

_pool: asyncpg.Pool | None = None


async def connect() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            user=settings.DB_USER,
            password=settings.DB_PASSWORD,
            database=settings.DB_NAME,
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            min_size=1,
            max_size=5,
        )
    return _pool


def pool() -> asyncpg.Pool | None:
    return _pool


async def close() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def ensure_schema(conn: asyncpg.Connection) -> bool:
    """Aplica o schema. Devolve True se as tabelas foram (re)criadas."""
    await conn.execute("CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS unaccent;")
    current = None
    if await conn.fetchval("SELECT to_regclass('public.index_meta') IS NOT NULL"):
        has_version = await conn.fetchval(
            "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'index_meta' AND column_name = 'schema_version')"
        )
        if has_version:
            current = await conn.fetchval("SELECT schema_version FROM index_meta WHERE id = 1")
    if current == SCHEMA_VERSION:
        return False
    await conn.execute("DROP TABLE IF EXISTS links, chunks, documents, index_meta CASCADE;")
    await conn.execute(SCHEMA_FILE.read_text(encoding="utf-8"))
    return True
