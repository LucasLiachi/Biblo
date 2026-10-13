from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.db import pool
from app.middlewares.security import verify_session_token
from app.services.embeddings import embeddings_client
from app.services.library_fs import library_of
from app.services.parser import normalize_link_target
from app.services.rag import hybrid_search

router = APIRouter(prefix="/api", tags=["Busca"], dependencies=[Depends(verify_session_token)])


def _require_pool():  # type: ignore[no-untyped-def]
    if (p := pool()) is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Índice indisponível: o banco não está conectado.")
    return p


@router.get("/search")
async def search(
    q: str = Query(..., min_length=1, max_length=500),
    limit: int = Query(10, ge=1, le=50),
    library: str | None = Query(None),
) -> dict[str, object]:
    async with _require_pool().acquire() as conn:
        hits, mode = await hybrid_search(conn, q, embeddings_client, limit=limit, library=library)
    return {"mode": mode, "results": [h.citation() for h in hits]}


# [[wikilinks]] resolvem só dentro da biblioteca do documento: link_key = "<biblioteca>/<caminho sem extensão>".
RESOLVE_IN_LIBRARY = """
    SELECT t.path FROM documents t
    WHERE t.link_key = $1 || '/' || {target} OR (starts_with(t.link_key, $1 || '/') AND t.link_key LIKE '%/' || {target})
    ORDER BY (t.link_key = $1 || '/' || {target}) DESC, length(t.link_key) LIMIT 1
"""


@router.get("/links")
async def links(path: str = Query(...)) -> dict[str, object]:
    """Backlinks (quem aponta para este documento) e links de saída resolvidos, dentro da mesma biblioteca."""
    library = library_of(path)
    key = normalize_link_target(path)[len(library) + 1 :]
    stem_key = key.rsplit("/", 1)[-1]
    async with _require_pool().acquire() as conn:
        backlinks = await conn.fetch(
            """
            SELECT DISTINCT d.path, d.title, d.kind FROM links l
            JOIN documents d ON d.id = l.source_id
            WHERE (l.target_key = $2 OR l.target_key = $3) AND d.path <> $4 AND starts_with(d.path, $1 || '/')
            ORDER BY d.path
            """,
            library, key, stem_key, path,
        )
        outgoing = await conn.fetch(
            f"""
            SELECT l.target_key, ({RESOLVE_IN_LIBRARY.format(target="l.target_key")}) AS path
            FROM links l JOIN documents d ON d.id = l.source_id
            WHERE d.path = $2 ORDER BY l.target_key
            """,
            library, path,
        )
    return {
        "backlinks": [dict(r) for r in backlinks],
        "outgoing": [{"target": r["target_key"], "path": r["path"]} for r in outgoing],
    }


@router.get("/links/resolve")
async def resolve_link(target: str = Query(..., min_length=1), library: str = Query(..., min_length=1)) -> dict[str, str | None]:
    """Resolve o alvo de um [[wikilink]] para um caminho da biblioteca (ou null se não existir)."""
    key = normalize_link_target(target)
    async with _require_pool().acquire() as conn:
        path = await conn.fetchval(RESOLVE_IN_LIBRARY.format(target="$2"), library, key)
    return {"target": key, "path": path}
