from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.config import settings
from app.middlewares.security import verify_session_token
from app.services.indexer import get_indexer
from app.services.vault_fs import (
    ASSET_EXTENSIONS,
    DOCUMENT_EXTENSIONS,
    atomic_write_bytes,
    atomic_write_file,
    build_tree,
    compute_file_etag,
    move_path,
    move_to_trash,
    relative_to_vault,
    resolve_safe_path,
    safe_asset_name,
    unique_path,
)

router = APIRouter(prefix="/api", tags=["Vault"], dependencies=[Depends(verify_session_token)])


class CreateFilePayload(BaseModel):
    path: str
    content: str = ""


class WriteFilePayload(BaseModel):
    content: str


class FolderPayload(BaseModel):
    path: str


class MovePayload(BaseModel):
    source: str
    destination: str


def _notify(*paths: str) -> None:
    if indexer := get_indexer():
        for p in paths:
            indexer.notify(str(settings.VAULT_ROOT / p))


def _document_path(path: str, must_exist: bool):  # type: ignore[no-untyped-def]
    target = resolve_safe_path(settings.VAULT_ROOT, path, must_exist=must_exist, allow_dir=False)
    if target.suffix.lower() not in DOCUMENT_EXTENSIONS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Só notas (.md) e diagramas (.excalidraw) são editáveis.")
    return target


def _check_size(content: str) -> None:
    if len(content.encode("utf-8")) > settings.MAX_DOCUMENT_MB * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"Documento excede {settings.MAX_DOCUMENT_MB} MB.")


@router.get("/files/tree")
async def get_vault_tree() -> dict[str, list[dict[str, object]]]:
    return {"tree": build_tree(settings.VAULT_ROOT)}


@router.get("/files")
async def read_file(path: str = Query(...)) -> Response:
    target = _document_path(path, must_exist=True)
    data = target.read_bytes()
    etag = compute_file_etag(target)
    return Response(content=data, media_type="text/plain; charset=utf-8", headers={"ETag": f'"{etag}"'})


@router.post("/files", status_code=status.HTTP_201_CREATED)
async def create_file(payload: CreateFilePayload) -> dict[str, str]:
    target = _document_path(payload.path, must_exist=False)
    if target.exists():
        raise HTTPException(status.HTTP_409_CONFLICT, "Já existe um arquivo com esse nome.")
    _check_size(payload.content)
    etag = atomic_write_file(target, payload.content)
    rel = relative_to_vault(settings.VAULT_ROOT, target)
    _notify(rel)
    return {"path": rel, "etag": etag}


@router.put("/files")
async def write_file(
    payload: WriteFilePayload, path: str = Query(...), if_match: str | None = Header(None, alias="If-Match")
) -> dict[str, str]:
    target = _document_path(path, must_exist=True)
    if not if_match:
        raise HTTPException(status.HTTP_428_PRECONDITION_REQUIRED, "Envie o cabeçalho If-Match com o ETag base.")
    current = compute_file_etag(target)
    if current != if_match.strip().strip('"'):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "error": "write_conflict",
                "message": "O arquivo foi modificado fora do Biblo desde que você o abriu.",
                "current_etag": current,
                "current_content": target.read_text(encoding="utf-8", errors="replace"),
            },
        )
    _check_size(payload.content)
    etag = atomic_write_file(target, payload.content)
    _notify(path)
    return {"path": path, "etag": etag}


@router.delete("/files", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(path: str = Query(...)) -> Response:
    target = resolve_safe_path(settings.VAULT_ROOT, path, must_exist=True)
    if not target.is_file():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Use DELETE /api/folders para pastas.")
    move_to_trash(settings.VAULT_ROOT, target)
    _notify(path)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/files/move")
async def move(payload: MovePayload) -> dict[str, str]:
    """Renomeia ou move arquivo ou pasta dentro do vault."""
    source = resolve_safe_path(settings.VAULT_ROOT, payload.source, must_exist=True)
    destination = resolve_safe_path(settings.VAULT_ROOT, payload.destination)
    if source.is_file() and source.suffix.lower() != destination.suffix.lower():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mover não pode trocar a extensão do arquivo.")
    if source == settings.VAULT_ROOT.resolve():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A raiz do vault não pode ser movida.")
    move_path(source, destination)
    rel = relative_to_vault(settings.VAULT_ROOT, destination)
    _notify(payload.source, rel)
    return {"path": rel}


@router.post("/folders", status_code=status.HTTP_201_CREATED)
async def create_folder(payload: FolderPayload) -> dict[str, str]:
    target = resolve_safe_path(settings.VAULT_ROOT, payload.path)
    if target.suffix:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nome de pasta não pode ter extensão.")
    if target.exists():
        raise HTTPException(status.HTTP_409_CONFLICT, "Já existe um item com esse nome.")
    target.mkdir(parents=True)
    return {"path": relative_to_vault(settings.VAULT_ROOT, target)}


@router.delete("/folders", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(path: str = Query(...), recursive: bool = Query(False)) -> Response:
    target = resolve_safe_path(settings.VAULT_ROOT, path, must_exist=True)
    if not target.is_dir():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "O caminho não é uma pasta.")
    if any(target.iterdir()) and not recursive:
        raise HTTPException(status.HTTP_409_CONFLICT, "A pasta não está vazia. Confirme a exclusão recursiva.")
    move_to_trash(settings.VAULT_ROOT, target)
    _notify(path)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/assets", status_code=status.HTTP_201_CREATED)
async def upload_asset(file: UploadFile = File(...), folder: str = Query("assets")) -> dict[str, object]:
    limit = settings.MAX_UPLOAD_MB * 1024 * 1024
    content = await file.read(limit + 1)
    if len(content) > limit:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"Arquivo excede {settings.MAX_UPLOAD_MB} MB.")
    name = safe_asset_name(file.filename or "asset")
    if not name.endswith(tuple(ASSET_EXTENSIONS)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Só imagens (png, jpg, gif, webp, svg) são aceitas.")
    target = unique_path(resolve_safe_path(settings.VAULT_ROOT, f"{folder.strip('/')}/{name}"))
    atomic_write_bytes(target, content)
    return {"path": relative_to_vault(settings.VAULT_ROOT, target), "size": len(content)}


@router.get("/assets")
async def get_asset(path: str = Query(...)) -> FileResponse:
    target = resolve_safe_path(settings.VAULT_ROOT, path, must_exist=True)
    if target.suffix.lower() not in ASSET_EXTENSIONS or not target.is_file():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Não é um asset de imagem.")
    headers = {
        "Cache-Control": "private, max-age=60",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    }
    if target.suffix.lower() == ".svg":
        # SVG pode carregar script: nunca renderiza inline na origem do Biblo.
        headers["Content-Disposition"] = f'attachment; filename="{target.name}"'
    return FileResponse(target, headers=headers)
