import hashlib
import os
import re
import shutil
import time
import unicodedata
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status

DOCUMENT_EXTENSIONS = {".md", ".markdown", ".excalidraw"}
ASSET_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"}
ALLOWED_EXTENSIONS = DOCUMENT_EXTENSIONS | ASSET_EXTENSIONS

def _bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def resolve_safe_path(
    vault_root: Path, relative_path: str, must_exist: bool = False, allow_dir: bool = True
) -> Path:
    """Resolve um caminho relativo garantindo que ele fique dentro do vault.

    O caminho chega já decodificado pelo framework; não decodificamos de novo para
    não abrir brecha de encoding duplo. Qualquer '%' remanescente é tratado como
    literal e '..' / '.' são proibidos em qualquer componente.
    """
    if "\0" in relative_path:
        raise _bad_request("Byte nulo detectado no caminho.")

    normalized = unicodedata.normalize("NFC", relative_path).replace("\\", "/")
    if normalized.startswith("/") or re.match(r"^[A-Za-z]:", normalized):
        raise _bad_request("Caminhos absolutos não são permitidos.")

    parts = [p for p in normalized.split("/") if p != ""]
    if not parts:
        raise _bad_request("Caminho relativo não pode ser vazio.")
    if any(p in ("..", ".") or "%2e" in p.lower() for p in parts):
        raise _bad_request("Sequências de navegação relativa ('..' ou '.') não são permitidas.")

    root = vault_root.resolve(strict=False)
    candidate = (root / "/".join(parts)).resolve(strict=False)
    if not candidate.is_relative_to(root):
        raise _bad_request("Tentativa de path traversal bloqueada.")

    # resolve() já seguiu os links; conferimos cada componente original.
    current = root
    for part in parts:
        current = current / part
        if current.is_symlink():
            raise _bad_request("Symlinks dentro do vault são proibidos por segurança.")

    if candidate.suffix and candidate.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise _bad_request(f"Extensão de arquivo '{candidate.suffix}' não permitida.")
    if not candidate.suffix and not allow_dir:
        raise _bad_request("Informe um arquivo com extensão (.md ou .excalidraw).")
    if must_exist and not candidate.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"'{'/'.join(parts)}' não encontrado no vault.")
    return candidate


def relative_to_vault(vault_root: Path, path: Path) -> str:
    return path.resolve().relative_to(vault_root.resolve()).as_posix()


def is_hidden(rel_path: str) -> bool:
    return any(part.startswith(".") for part in rel_path.split("/"))


def document_kind(path: Path | str) -> str | None:
    suffix = Path(path).suffix.lower()
    if suffix == ".excalidraw":
        return "diagram"
    if suffix in (".md", ".markdown"):
        return "markdown"
    if suffix in ASSET_EXTENSIONS:
        return "asset"
    return None


def compute_sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def compute_file_etag(file_path: Path) -> str:
    if not file_path.is_file():
        return ""
    return compute_sha256(file_path.read_bytes())


def atomic_write_bytes(target: Path, data: bytes) -> str:
    target.parent.mkdir(parents=True, exist_ok=True)
    temp_file = target.parent / f".tmp_{os.getpid()}_{time.time_ns()}"
    with open(temp_file, "wb") as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())
    os.replace(temp_file, target)
    return compute_sha256(data)


def atomic_write_file(target: Path, content: str) -> str:
    return atomic_write_bytes(target, content.encode("utf-8"))


def build_tree(vault_root: Path) -> list[dict[str, Any]]:
    """Lista plana e ordenada do vault (pastas primeiro), sem ocultos nem extensões estranhas."""
    if not vault_root.exists():
        return []
    entries: list[dict[str, Any]] = []
    for item in vault_root.rglob("*"):
        rel = item.relative_to(vault_root).as_posix()
        if is_hidden(rel) or item.is_symlink():
            continue
        if item.is_dir():
            entries.append({"path": rel, "name": item.name, "type": "directory"})
        elif item.is_file() and item.suffix.lower() in ALLOWED_EXTENSIONS:
            entries.append({
                "path": rel,
                "name": item.name,
                "type": "file",
                "kind": document_kind(item),
                "size": item.stat().st_size,
            })
    entries.sort(key=lambda e: (e["path"].count("/"), e["type"] != "directory", e["path"].lower()))
    return entries


def safe_asset_name(filename: str) -> str:
    """Nome de arquivo seguro para assets: só o basename, sem acentos nem espaços."""
    base = Path(filename.replace("\\", "/")).name
    stem, suffix = Path(base).stem, Path(base).suffix.lower()
    stem = unicodedata.normalize("NFKD", stem).encode("ascii", "ignore").decode()
    stem = re.sub(r"[^A-Za-z0-9_-]+", "-", stem).strip("-").lower() or "asset"
    return f"{stem[:60]}{suffix}"


def unique_path(target: Path) -> Path:
    if not target.exists():
        return target
    for i in range(2, 1000):
        candidate = target.with_name(f"{target.stem}-{i}{target.suffix}")
        if not candidate.exists():
            return candidate
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Não foi possível gerar nome único.")


TRASH_DIR = ".lixeira"


def move_to_trash(vault_root: Path, target: Path) -> Path:
    """Exclusão reversível: move para vault/.lixeira/<carimbo>/<caminho original>."""
    stamp = time.strftime("%Y%m%d-%H%M%S")
    destination = unique_path(vault_root / TRASH_DIR / stamp / relative_to_vault(vault_root, target))
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(target), str(destination))
    return destination


def move_path(source: Path, destination: Path) -> None:
    if destination.exists():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Já existe um item com esse nome no destino.")
    if source.is_dir() and destination.is_relative_to(source):
        raise _bad_request("Não é possível mover uma pasta para dentro dela mesma.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(source), str(destination))
