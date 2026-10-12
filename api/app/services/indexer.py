"""Indexador: mantém o índice do Postgres fiel ao vault em disco.

- No boot, reconcilia disco x banco (novos, alterados e órfãos).
- Em execução, recebe eventos do watchdog (inotify ou polling) e da própria API.
- Embeddings são opcionais: sem provedor, o índice fica só com FTS e os vetores
  faltantes são completados quando o provedor volta.
"""

import asyncio
import os
import platform
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import asyncpg
from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer
from watchdog.observers.api import BaseObserver
from watchdog.observers.polling import PollingObserver

from app.config import settings
from app.services.embeddings import EmbeddingsClient, EmbeddingsUnavailable
from app.services.parser import normalize_link_target, parse_document
from app.services.vault_fs import DOCUMENT_EXTENSIONS, compute_sha256, is_hidden

DEBOUNCE_SECONDS = 0.8
EMBED_BATCH = 16


class IndexerState:
    def __init__(self) -> None:
        self.status = "starting"  # starting | idle | indexing | error | offline
        self.db_connected = False
        self.watcher_mode = "off"
        self.total_documents = 0
        self.total_chunks = 0
        self.chunks_without_embedding = 0
        self.pending = 0
        self.last_reconciliation: str | None = None
        self.last_error: str | None = None
        self.embedding_model = ""
        self.embeddings_error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return dict(self.__dict__)


def detect_needs_polling(vault_root: Path) -> bool:
    """inotify não atravessa drvfs/9p (WSL2 em /mnt/c, alguns bind mounts do Docker Desktop)."""
    resolved = str(vault_root.resolve())
    if "microsoft" in platform.release().lower() and resolved.startswith("/mnt/"):
        return True
    try:
        with open("/proc/mounts", encoding="utf-8") as f:
            for line in f:
                parts = line.split()
                if len(parts) >= 3 and resolved.startswith(parts[1]) and parts[2] in ("9p", "drvfs", "fuse.grpcfuse", "virtiofs"):
                    if parts[1] != "/":
                        return True
    except OSError:
        pass
    return False


class _Handler(FileSystemEventHandler):
    def __init__(self, indexer: "Indexer") -> None:
        self.indexer = indexer

    # Só eventos de escrita. "opened"/"closed_no_write" chegam a cada leitura (inclusive as do
    # próprio indexador) e realimentariam a fila sem fim.
    WRITE_EVENTS = frozenset({"created", "modified", "deleted", "moved", "closed"})

    def on_any_event(self, event: FileSystemEvent) -> None:
        if event.event_type not in self.WRITE_EVENTS:
            return
        if event.is_directory and event.event_type not in ("moved", "deleted"):
            return
        paths = [event.src_path]
        if dest := getattr(event, "dest_path", None):
            paths.append(dest)
        for raw in paths:
            self.indexer.notify_threadsafe(os.fsdecode(raw))


class Indexer:
    def __init__(self, vault_root: Path, pool: asyncpg.Pool | None, embedder: EmbeddingsClient) -> None:
        self.vault_root = vault_root.resolve()
        self.pool = pool
        self.embedder = embedder
        self.state = IndexerState()
        self.state.embedding_model = embedder.model_id if embedder.enabled else "desativado"
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._observer: BaseObserver | None = None
        self._tasks: list[asyncio.Task[None]] = []

    # ---------- ciclo de vida ----------

    async def start(self) -> None:
        self._loop = asyncio.get_running_loop()
        if self.pool is None:
            self.state.status = "offline"
            self.state.last_error = "Banco indisponível: busca e chat ficam desativados até a reconexão."
            return
        self.state.db_connected = True
        await self.check_embedding_space()
        await self.reconcile()
        self._start_observer()
        self._tasks.append(asyncio.create_task(self._worker()))
        self._tasks.append(asyncio.create_task(self._backfill_loop()))

    async def stop(self) -> None:
        if self._observer:
            self._observer.stop()
            self._observer.join(timeout=3)
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)

    def _start_observer(self) -> None:
        mode = settings.WATCHER_MODE
        if mode == "auto":
            mode = "polling" if detect_needs_polling(self.vault_root) else "inotify"
        observer: BaseObserver = PollingObserver(timeout=2.0) if mode == "polling" else Observer()
        observer.schedule(_Handler(self), str(self.vault_root), recursive=True)
        observer.daemon = True
        observer.start()
        self._observer = observer
        self.state.watcher_mode = mode

    # ---------- entrada de eventos ----------

    def notify_threadsafe(self, absolute_path: str) -> None:
        if self._loop is not None:
            self._loop.call_soon_threadsafe(self.notify, absolute_path)

    def notify(self, absolute_path: str) -> None:
        """Agenda (re)indexação de um caminho absoluto, de arquivo ou pasta."""
        self._queue.put_nowait(absolute_path)
        self.state.pending = self._queue.qsize()

    async def _worker(self) -> None:
        while True:
            first = await self._queue.get()
            batch = {first}
            await asyncio.sleep(DEBOUNCE_SECONDS)
            while not self._queue.empty():
                batch.add(self._queue.get_nowait())
            self.state.pending = 0
            self.state.status = "indexing"
            for path in sorted(batch):
                try:
                    await self._sync_path(Path(path))
                except Exception as exc:  # um arquivo ruim não derruba o indexador
                    self.state.last_error = f"{path}: {exc}"
            await self.refresh_counts()
            self.state.status = "idle"

    # ---------- sincronização ----------

    def _rel(self, path: Path) -> str | None:
        try:
            rel = path.resolve().relative_to(self.vault_root).as_posix()
        except ValueError:
            return None
        return None if is_hidden(rel) else rel

    async def _sync_path(self, path: Path) -> None:
        rel = self._rel(path)
        if rel is None:
            return
        if path.is_dir():
            for child in path.rglob("*"):
                if child.suffix.lower() in DOCUMENT_EXTENSIONS:
                    await self._sync_path(child)
            return
        if path.suffix.lower() not in DOCUMENT_EXTENSIONS and path.exists():
            return
        if not path.exists():
            await self._delete_prefix(rel)
            return
        # Eco do autosave: a API já notificou este conteúdo, então o hash bate e index_file não refaz nada.
        data = path.read_bytes()
        await self.index_file(rel, data, compute_sha256(data))

    async def _delete_prefix(self, rel: str) -> None:
        assert self.pool is not None
        async with self.pool.acquire() as conn:
            await conn.execute("DELETE FROM documents WHERE path = $1 OR path LIKE $2", rel, rel.rstrip("/") + "/%")

    async def index_file(self, rel: str, data: bytes, etag: str, force: bool = False) -> bool:
        """Indexa um documento se o hash mudou. Devolve True se reindexou."""
        assert self.pool is not None
        if len(data) > settings.MAX_DOCUMENT_MB * 1024 * 1024:
            self.state.last_error = f"{rel} excede MAX_DOCUMENT_MB={settings.MAX_DOCUMENT_MB}; não indexado."
            return False
        async with self.pool.acquire() as conn:
            known = await conn.fetchval("SELECT content_hash FROM documents WHERE path = $1", rel)
        if known == etag and not force:
            return False

        parsed = parse_document(rel, data.decode("utf-8", errors="replace"), max_chunks=settings.MAX_CHUNKS_PER_DOC)
        vectors: list[list[float] | None] = [None] * len(parsed.chunks)
        if self.embedder.enabled and parsed.chunks:
            try:
                computed: list[list[float]] = []
                texts = [f"{c.heading}\n{c.text}" for c in parsed.chunks]
                for i in range(0, len(texts), EMBED_BATCH):
                    computed += await self.embedder.embed(texts[i : i + EMBED_BATCH])
                vectors = list(computed)
                self.state.embeddings_error = None
            except EmbeddingsUnavailable as exc:
                self.state.embeddings_error = str(exc)

        link_key = normalize_link_target(rel)
        async with self.pool.acquire() as conn, conn.transaction():
            doc_id = await conn.fetchval(
                """
                INSERT INTO documents (path, link_key, kind, title, content_hash, updated_at)
                VALUES ($1, $2, $3, $4, $5, now())
                ON CONFLICT (path) DO UPDATE SET link_key = EXCLUDED.link_key, kind = EXCLUDED.kind,
                    title = EXCLUDED.title, content_hash = EXCLUDED.content_hash, updated_at = now()
                RETURNING id
                """,
                rel, link_key, parsed.kind, parsed.title, etag,
            )
            await conn.execute("DELETE FROM chunks WHERE document_id = $1", doc_id)
            await conn.executemany(
                """
                INSERT INTO chunks (document_id, ordinal, start_line, end_line, heading, text, embedding_model, embedding)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)
                """,
                [
                    (doc_id, c.ordinal, c.start_line, c.end_line, c.heading, c.text,
                     self.embedder.model_id if v else None, str(v) if v else None)
                    for c, v in zip(parsed.chunks, vectors, strict=True)
                ],
            )
            await conn.execute("DELETE FROM links WHERE source_id = $1", doc_id)
            await conn.executemany(
                "INSERT INTO links (source_id, target_key) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                [(doc_id, target) for target in parsed.links],
            )
        return True

    async def reconcile(self, force: bool = False) -> dict[str, int]:
        """Compara disco e banco: indexa novos/alterados e remove órfãos."""
        assert self.pool is not None
        self.state.status = "indexing"
        on_disk: dict[str, Path] = {}
        for item in self.vault_root.rglob("*"):
            rel = self._rel(item)
            if rel and item.is_file() and not item.is_symlink() and item.suffix.lower() in DOCUMENT_EXTENSIONS:
                on_disk[rel] = item
        async with self.pool.acquire() as conn:
            known = {r["path"] for r in await conn.fetch("SELECT path FROM documents")}
            orphans = sorted(known - on_disk.keys())
            if orphans:
                await conn.execute("DELETE FROM documents WHERE path = ANY($1::text[])", orphans)
        changed = 0
        for rel, path in sorted(on_disk.items()):
            try:
                data = path.read_bytes()
                changed += await self.index_file(rel, data, compute_sha256(data), force=force)
            except Exception as exc:
                self.state.last_error = f"{rel}: {exc}"
        await self.refresh_counts()
        self.state.last_reconciliation = datetime.now(UTC).isoformat()
        self.state.status = "idle"
        return {"scanned": len(on_disk), "reindexed": changed, "removed": len(orphans)}

    async def check_embedding_space(self) -> None:
        """Se o modelo de embeddings mudou, invalida vetores antigos (espaços incompatíveis)."""
        assert self.pool is not None
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT embedding_provider, embedding_model FROM index_meta WHERE id = 1")
            configured = (self.embedder.provider, self.embedder.model)
            if row and (row["embedding_provider"], row["embedding_model"]) != configured:
                await conn.execute(
                    "UPDATE chunks SET embedding = NULL, embedding_model = NULL WHERE embedding_model IS DISTINCT FROM $1",
                    self.embedder.model_id,
                )
                await conn.execute(
                    "UPDATE index_meta SET embedding_provider = $1, embedding_model = $2, embedding_dim = $3, updated_at = now()",
                    self.embedder.provider, self.embedder.model, self.embedder.dim,
                )

    async def _backfill_loop(self) -> None:
        """Completa vetores faltantes quando o provedor de embeddings fica disponível."""
        while True:
            await asyncio.sleep(60)
            if self.embedder.enabled and self.state.chunks_without_embedding:
                try:
                    await self.backfill_embeddings()
                except EmbeddingsUnavailable as exc:
                    self.state.embeddings_error = str(exc)

    async def backfill_embeddings(self, limit: int = 256) -> int:
        assert self.pool is not None
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT id, heading, text FROM chunks WHERE embedding IS NULL ORDER BY id LIMIT $1", limit
            )
            done = 0
            for i in range(0, len(rows), EMBED_BATCH):
                batch = rows[i : i + EMBED_BATCH]
                vectors = await self.embedder.embed([f"{r['heading']}\n{r['text']}" for r in batch])
                await conn.executemany(
                    "UPDATE chunks SET embedding = $2::vector, embedding_model = $3 WHERE id = $1",
                    [(r["id"], str(v), self.embedder.model_id) for r, v in zip(batch, vectors, strict=True)],
                )
                done += len(batch)
        self.state.embeddings_error = None
        await self.refresh_counts()
        return done

    async def refresh_counts(self) -> None:
        assert self.pool is not None
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT (SELECT count(*) FROM documents) AS docs,
                       (SELECT count(*) FROM chunks) AS chunks,
                       (SELECT count(*) FROM chunks WHERE embedding IS NULL) AS missing
                """
            )
        self.state.total_documents = row["docs"]
        self.state.total_chunks = row["chunks"]
        self.state.chunks_without_embedding = row["missing"]


_indexer: Indexer | None = None


def get_indexer() -> Indexer | None:
    return _indexer


def set_indexer(indexer: Indexer | None) -> None:
    global _indexer
    _indexer = indexer
