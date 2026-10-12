import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app import db
from app.config import settings
from app.middlewares.security import SESSION_COOKIE, SecurityMiddleware
from app.routers.chat import router as chat_router
from app.routers.files import router as files_router
from app.routers.index_routes import router as index_router
from app.routers.search import router as search_router
from app.services.embeddings import embeddings_client
from app.services.indexer import Indexer, set_indexer

log = logging.getLogger("biblo")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings.VAULT_ROOT.mkdir(parents=True, exist_ok=True)
    connection_pool = None
    try:
        connection_pool = await db.connect()
        async with connection_pool.acquire() as conn:
            if await db.ensure_schema(conn):
                log.warning("Schema do índice (re)criado; o vault será reindexado do disco.")
    except Exception as exc:  # API segue servindo o vault mesmo sem banco
        log.error("Banco indisponível (%s). Edição funciona; busca e chat ficam desativados.", exc)
        connection_pool = None
    indexer = Indexer(settings.VAULT_ROOT, connection_pool, embeddings_client)
    set_indexer(indexer)
    await indexer.start()
    yield
    await indexer.stop()
    set_indexer(None)
    await db.close()


app = FastAPI(
    title="Biblo Knowledge Studio API",
    description="Vault local-first (Markdown + Excalidraw), índice híbrido e copiloto RAG.",
    version="0.2.0",
    docs_url="/api/docs" if settings.is_dev else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if settings.is_dev else None,
    lifespan=lifespan,
)

app.add_middleware(SecurityMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "If-Match", "X-Biblo-Token"],
    expose_headers=["ETag"],
)
# Anti-DNS-rebinding: só aceita Host conhecido (a porta é ignorada pelo middleware).
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.ALLOWED_HOSTS)


@app.get("/api/health", tags=["Saúde"])
async def health_check() -> dict[str, object]:
    return {"status": "ok", "db_connected": db.pool() is not None, "vault_mounted": settings.VAULT_ROOT.exists()}


@app.get("/api/session", tags=["Sessão"])
async def open_session(request: Request) -> Response:
    """Entrega o token local num cookie HttpOnly + SameSite=Strict.

    O JavaScript nunca vê o token. Sites de terceiros não conseguem enviá-lo
    (SameSite) nem lê-lo (CORS), e o TrustedHost barra DNS rebinding.
    """
    if request.headers.get("sec-fetch-site") == "cross-site":
        return Response(status_code=403)
    response = Response(status_code=204)
    response.set_cookie(
        SESSION_COOKIE, settings.SESSION_TOKEN, httponly=True, samesite="strict", path="/api", secure=False
    )
    return response


app.include_router(files_router)
app.include_router(search_router)
app.include_router(chat_router)
app.include_router(index_router)
