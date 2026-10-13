import os
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.services.library_fs import resolve_safe_path, safe_asset_name


@pytest.fixture
def root(tmp_path: Path) -> Path:
    root = tmp_path / "bibliotecas"
    (root / "notas").mkdir(parents=True)
    (root / "notas" / "arch.md").write_text("# Arquitetura", encoding="utf-8")
    (root / "diagramas").mkdir()
    (root / "diagramas" / "fluxo.excalidraw").write_text("{}", encoding="utf-8")
    return root


def test_valid_paths_resolve_inside_root(root: Path) -> None:
    assert resolve_safe_path(root, "notas/arch.md", must_exist=True).name == "arch.md"
    assert resolve_safe_path(root, "diagramas/fluxo.excalidraw", must_exist=True).is_file()
    assert resolve_safe_path(root, "notas/sub pasta").name == "sub pasta"


@pytest.mark.parametrize(
    "attack",
    [
        "../etc/passwd",
        "../../shadow",
        "/etc/passwd",
        "C:/Windows/win.ini",
        "notas/../../fora.md",
        "..\\windows\\system32",
        "notas\\..\\..\\fora.md",
        "notas/%2e%2e/fora.md",
        "notas/./arch.md",
        "",
        "///",
    ],
)
def test_traversal_attempts_are_rejected(root: Path, attack: str) -> None:
    with pytest.raises(HTTPException) as exc:
        resolve_safe_path(root, attack)
    assert exc.value.status_code == 400


def test_null_byte_is_rejected(root: Path) -> None:
    with pytest.raises(HTTPException) as exc:
        resolve_safe_path(root, "notas/\0x.md")
    assert exc.value.status_code == 400


def test_disallowed_extension_is_rejected(root: Path) -> None:
    with pytest.raises(HTTPException) as exc:
        resolve_safe_path(root, "notas/script.sh")
    assert "não permitida" in exc.value.detail


def test_symlink_inside_root_is_rejected(root: Path, tmp_path: Path) -> None:
    outside = tmp_path / "segredos"
    outside.mkdir()
    (outside / "id_rsa.md").write_text("segredo", encoding="utf-8")
    try:
        os.symlink(outside, root / "notas" / "link")
    except OSError:
        pytest.skip("Ambiente não permite symlinks")
    with pytest.raises(HTTPException) as exc:
        resolve_safe_path(root, "notas/link/id_rsa.md")
    assert exc.value.status_code == 400


def test_missing_file_returns_404_when_required(root: Path) -> None:
    with pytest.raises(HTTPException) as exc:
        resolve_safe_path(root, "notas/nao-existe.md", must_exist=True)
    assert exc.value.status_code == 404


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("../../Foto Férias.PNG", "foto-ferias.png"), ("..\\x\\evil.svg", "evil.svg"), ("???.jpg", "asset.jpg")],
)
def test_asset_names_are_sanitized(raw: str, expected: str) -> None:
    assert safe_asset_name(raw) == expected
