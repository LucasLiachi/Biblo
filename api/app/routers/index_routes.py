import asyncio

from fastapi import APIRouter, Depends, HTTPException, status

from app.middlewares.security import verify_session_token
from app.services.indexer import get_indexer

router = APIRouter(prefix="/api/index", tags=["Índice"], dependencies=[Depends(verify_session_token)])


@router.get("/status")
async def get_index_status() -> dict[str, object]:
    indexer = get_indexer()
    if indexer is None:
        return {"status": "offline", "db_connected": False, "last_error": "Indexador não iniciado."}
    return indexer.state.to_dict()


@router.post("/rebuild", status_code=status.HTTP_202_ACCEPTED)
async def trigger_rebuild() -> dict[str, str]:
    indexer = get_indexer()
    if indexer is None or indexer.pool is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Banco indisponível: não há índice para reconstruir.")
    asyncio.create_task(indexer.reconcile(force=True))
    return {"status": "reindexing_started"}
