"""Rotas do vault e barreiras de segurança, sem banco (ASGITransport não roda o lifespan)."""

from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest

from app.config import settings
from app.main import app

TOKEN = {"X-Biblo-Token": settings.SESSION_TOKEN}
JSON = {**TOKEN, "Content-Type": "application/json"}


@pytest.fixture
def vault(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    root = tmp_path / "vault"
    (root / "notas").mkdir(parents=True)
    (root / "notas" / "doc.md").write_text("Versão inicial", encoding="utf-8")
    monkeypatch.setattr(settings, "VAULT_ROOT", root)
    return root


@pytest.fixture
async def client(vault: Path) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://localhost") as c:
        yield c


async def test_requests_without_session_are_rejected(client: httpx.AsyncClient) -> None:
    assert (await client.get("/api/files/tree")).status_code == 401
    assert (await client.get("/api/files/tree", headers={"X-Biblo-Token": "errado"})).status_code == 401


async def test_health_is_public(client: httpx.AsyncClient) -> None:
    assert (await client.get("/api/health")).json()["status"] == "ok"


async def test_unknown_host_is_rejected(client: httpx.AsyncClient) -> None:
    res = await client.get("/api/health", headers={"Host": "attacker.evil"})
    assert res.status_code == 400


async def test_session_cookie_is_httponly_strict_and_authenticates(client: httpx.AsyncClient) -> None:
    res = await client.get("/api/session")
    assert res.status_code == 204
    cookie = res.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie
    assert (await client.get("/api/files/tree")).status_code == 200


async def test_session_refuses_cross_site_fetch(client: httpx.AsyncClient) -> None:
    assert (await client.get("/api/session", headers={"Sec-Fetch-Site": "cross-site"})).status_code == 403


async def test_text_plain_write_is_blocked(client: httpx.AsyncClient) -> None:
    res = await client.post("/api/files", content='{"path":"notas/x.md"}', headers={**TOKEN, "Content-Type": "text/plain"})
    assert res.status_code == 415


async def test_foreign_origin_write_is_blocked(client: httpx.AsyncClient) -> None:
    res = await client.post("/api/folders", json={"path": "x"}, headers={**JSON, "Origin": "https://evil.example"})
    assert res.status_code == 403


async def test_tree_lists_folders_and_documents(client: httpx.AsyncClient, vault: Path) -> None:
    (vault / ".lixeira").mkdir()
    (vault / ".lixeira" / "velho.md").write_text("x")
    (vault / "notas" / "script.sh").write_text("x")
    tree = (await client.get("/api/files/tree", headers=TOKEN)).json()["tree"]
    paths = [e["path"] for e in tree]
    assert paths == ["notas", "notas/doc.md"]


async def test_read_then_conditional_write(client: httpx.AsyncClient) -> None:
    res = await client.get("/api/files", params={"path": "notas/doc.md"}, headers=TOKEN)
    etag = res.headers["etag"]
    assert res.text == "Versão inicial"

    no_precondition = await client.put("/api/files", params={"path": "notas/doc.md"}, json={"content": "a"}, headers=JSON)
    assert no_precondition.status_code == 428

    ok = await client.put(
        "/api/files", params={"path": "notas/doc.md"}, json={"content": "novo"}, headers={**JSON, "If-Match": etag}
    )
    assert ok.status_code == 200 and ok.json()["etag"] != etag.strip('"')


async def test_external_change_produces_409_with_disk_content(client: httpx.AsyncClient, vault: Path) -> None:
    etag = (await client.get("/api/files", params={"path": "notas/doc.md"}, headers=TOKEN)).headers["etag"]
    (vault / "notas" / "doc.md").write_text("Editado no VS Code", encoding="utf-8")
    res = await client.put(
        "/api/files", params={"path": "notas/doc.md"}, json={"content": "meu"}, headers={**JSON, "If-Match": etag}
    )
    assert res.status_code == 409
    assert res.json()["detail"]["current_content"] == "Editado no VS Code"
    assert (vault / "notas" / "doc.md").read_text(encoding="utf-8") == "Editado no VS Code"


async def test_create_file_refuses_overwrite(client: httpx.AsyncClient) -> None:
    created = await client.post("/api/files", json={"path": "notas/nova.md", "content": "# Nova"}, headers=JSON)
    assert created.status_code == 201
    again = await client.post("/api/files", json={"path": "notas/nova.md", "content": "x"}, headers=JSON)
    assert again.status_code == 409


async def test_traversal_through_query_is_rejected(client: httpx.AsyncClient) -> None:
    res = await client.get("/api/files", params={"path": "../../etc/passwd"}, headers=TOKEN)
    assert res.status_code == 400


async def test_folder_lifecycle_and_move(client: httpx.AsyncClient, vault: Path) -> None:
    assert (await client.post("/api/folders", json={"path": "projetos/alpha"}, headers=JSON)).status_code == 201
    moved = await client.post(
        "/api/files/move", json={"source": "notas/doc.md", "destination": "projetos/alpha/doc.md"}, headers=JSON
    )
    assert moved.status_code == 200 and (vault / "projetos" / "alpha" / "doc.md").exists()

    renamed = await client.post("/api/files/move", json={"source": "projetos", "destination": "arquivo"}, headers=JSON)
    assert renamed.status_code == 200 and (vault / "arquivo" / "alpha" / "doc.md").exists()

    into_itself = await client.post(
        "/api/files/move", json={"source": "arquivo", "destination": "arquivo/alpha/arquivo"}, headers=JSON
    )
    assert into_itself.status_code == 400

    not_empty = await client.delete("/api/folders", params={"path": "arquivo"}, headers=TOKEN)
    assert not_empty.status_code == 409
    removed = await client.delete("/api/folders", params={"path": "arquivo", "recursive": "true"}, headers=TOKEN)
    assert removed.status_code == 204 and not (vault / "arquivo").exists()
    trashed = list((vault / ".lixeira").glob("*/arquivo/alpha/doc.md"))
    assert len(trashed) == 1  # exclusão reversível


async def test_deleted_file_goes_to_hidden_trash(client: httpx.AsyncClient, vault: Path) -> None:
    assert (await client.delete("/api/files", params={"path": "notas/doc.md"}, headers=TOKEN)).status_code == 204
    assert not (vault / "notas" / "doc.md").exists()
    assert [p.read_text(encoding="utf-8") for p in (vault / ".lixeira").glob("*/notas/doc.md")] == ["Versão inicial"]
    tree = (await client.get("/api/files/tree", headers=TOKEN)).json()["tree"]
    assert all(".lixeira" not in e["path"] for e in tree)


async def test_move_cannot_change_extension(client: httpx.AsyncClient) -> None:
    res = await client.post(
        "/api/files/move", json={"source": "notas/doc.md", "destination": "notas/doc.excalidraw"}, headers=JSON
    )
    assert res.status_code == 400


async def test_svg_asset_is_served_as_attachment(client: httpx.AsyncClient, vault: Path) -> None:
    files = {"file": ("../../logo.svg", b"<svg onload='alert(1)'/>", "image/svg+xml")}
    up = await client.post("/api/assets", files=files, headers=TOKEN)
    assert up.status_code == 201 and up.json()["path"] == "assets/logo.svg"
    got = await client.get("/api/assets", params={"path": "assets/logo.svg"}, headers=TOKEN)
    assert got.headers["content-disposition"].startswith("attachment")
    assert got.headers["x-content-type-options"] == "nosniff"


async def test_upload_rejects_non_images(client: httpx.AsyncClient) -> None:
    files = {"file": ("nota.md", b"# x", "text/markdown")}
    assert (await client.post("/api/assets", files=files, headers=TOKEN)).status_code == 400


async def test_search_without_database_returns_503(client: httpx.AsyncClient) -> None:
    assert (await client.get("/api/search", params={"q": "x"}, headers=TOKEN)).status_code == 503
