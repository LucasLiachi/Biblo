from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.db import pool
from app.middlewares.security import verify_session_token
from app.services.embeddings import embeddings_client
from app.services.parser import normalize_link_target
from app.services.rag import hybrid_search

router = APIRouter(prefix="/api", tags=["Busca"], dependencies=[Depends(verify_session_token)])


def _require_pool():  # type: ignore[no-untyped-def]
    if (p := pool()) is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Índice indisponível: o banco não está conectado.")
    return p


@router.get("/search")
async def search(q: str = Query(..., min_length=1, max_length=500), limit: int = Query(10, ge=1, le=50)) -> dict[str, object]:
    async with _require_pool().acquire() as conn:
        hits, mode = await hybrid_search(conn, q, embeddings_client, limit=limit)
    return {"mode": mode, "results": [h.citation() for h in hits]}


@router.get("/links")
async def links(path: str = Query(...)) -> dict[str, object]:
    """Backlinks (quem aponta para este documento) e links de saída resolvidos."""
    key = normalize_link_target(path)
    stem_key = key.rsplit("/", 1)[-1]
    async with _require_pool().acquire() as conn:
        backlinks = await conn.fetch(
            """
            SELECT DISTINCT d.path, d.title, d.kind FROM links l
            JOIN documents d ON d.id = l.source_id
            WHERE (l.target_key = $1 OR l.target_key = $2) AND d.path <> $3
            ORDER BY d.path
            """,
            key, stem_key, path,
        )
        outgoing = await conn.fetch(
            """
            SELECT l.target_key,
                   (SELECT t.path FROM documents t
                    WHERE t.link_key = l.target_key OR t.link_key LIKE '%/' || l.target_key
                    ORDER BY length(t.link_key) LIMIT 1) AS path
            FROM links l JOIN documents d ON d.id = l.source_id
            WHERE d.path = $1 ORDER BY l.target_key
            """,
            path,
        )
    return {
        "backlinks": [dict(r) for r in backlinks],
        "outgoing": [{"target": r["target_key"], "path": r["path"]} for r in outgoing],
    }


@router.get("/links/resolve")
async def resolve_link(target: str = Query(..., min_length=1)) -> dict[str, str | None]:
    """Resolve o alvo de um [[wikilink]] para um caminho do vault (ou null se não existir)."""
    key = normalize_link_target(target)
    async with _require_pool().acquire() as conn:
        path = await conn.fetchval(
            """
            SELECT path FROM documents WHERE link_key = $1 OR link_key LIKE '%/' || $1
            ORDER BY (link_key = $1) DESC, length(link_key) LIMIT 1
            """,
            key,
        )
    return {"target": key, "path": path}
