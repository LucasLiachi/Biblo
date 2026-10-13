"""Rotas de arquivos e barreiras de segurança, sem banco (ASGITransport não roda o lifespan)."""

from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest

from app.config import settings
from app.main import app

TOKEN = {"X-Biblo-Token": settings.SESSION_TOKEN}
JSON = {**TOKEN, "Content-Type": "application/json"}


@pytest.fixture
def root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    root = tmp_path / "bibliotecas"
    (root / "acervo" / "notas").mkdir(parents=True)
    (root / "acervo" / "notas" / "doc.md").write_text("Versão inicial", encoding="utf-8")
    monkeypatch.setattr(settings, "LIBRARIES_ROOT", root)
    return root


@pytest.fixture
async def client(root: Path) -> AsyncIterator[httpx.AsyncClient]:
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
    res = await client.post("/api/files", content='{"path":"acervo/notas/x.md"}', headers={**TOKEN, "Content-Type": "text/plain"})
    assert res.status_code == 415


async def test_foreign_origin_write_is_blocked(client: httpx.AsyncClient) -> None:
    res = await client.post("/api/folders", json={"path": "acervo/x"}, headers={**JSON, "Origin": "https://evil.example"})
    assert res.status_code == 403


async def test_tree_lists_folders_and_documents(client: httpx.AsyncClient, root: Path) -> None:
    (root / "acervo" / ".lixeira").mkdir()
    (root / "acervo" / ".lixeira" / "velho.md").write_text("x")
    (root / "acervo" / "notas" / "script.sh").write_text("x")
    tree = (await client.get("/api/files/tree", headers=TOKEN)).json()["tree"]
    paths = [e["path"] for e in tree]
    assert tree[0] == {"path": "acervo", "name": "acervo", "type": "library"}
    assert paths == ["acervo", "acervo/notas", "acervo/notas/doc.md"]


async def test_read_then_conditional_write(client: httpx.AsyncClient) -> None:
    res = await client.get("/api/files", params={"path": "acervo/notas/doc.md"}, headers=TOKEN)
    etag = res.headers["etag"]
    assert res.text == "Versão inicial"

    no_precondition = await client.put("/api/files", params={"path": "acervo/notas/doc.md"}, json={"content": "a"}, headers=JSON)
    assert no_precondition.status_code == 428

    ok = await client.put(
        "/api/files", params={"path": "acervo/notas/doc.md"}, json={"content": "novo"}, headers={**JSON, "If-Match": etag}
    )
    assert ok.status_code == 200 and ok.json()["etag"] != etag.strip('"')


async def test_external_change_produces_409_with_disk_content(client: httpx.AsyncClient, root: Path) -> None:
    etag = (await client.get("/api/files", params={"path": "acervo/notas/doc.md"}, headers=TOKEN)).headers["etag"]
    (root / "acervo" / "notas" / "doc.md").write_text("Editado no VS Code", encoding="utf-8")
    res = await client.put(
        "/api/files", params={"path": "acervo/notas/doc.md"}, json={"content": "meu"}, headers={**JSON, "If-Match": etag}
    )
    assert res.status_code == 409
    assert res.json()["detail"]["current_content"] == "Editado no VS Code"
    assert (root / "acervo" / "notas" / "doc.md").read_text(encoding="utf-8") == "Editado no VS Code"


async def test_create_file_refuses_overwrite(client: httpx.AsyncClient) -> None:
    created = await client.post("/api/files", json={"path": "acervo/notas/nova.md", "content": "# Nova"}, headers=JSON)
    assert created.status_code == 201
    again = await client.post("/api/files", json={"path": "acervo/notas/nova.md", "content": "x"}, headers=JSON)
    assert again.status_code == 409


async def test_traversal_through_query_is_rejected(client: httpx.AsyncClient) -> None:
    res = await client.get("/api/files", params={"path": "../../etc/passwd"}, headers=TOKEN)
    assert res.status_code == 400


async def test_folder_lifecycle_and_move(client: httpx.AsyncClient, root: Path) -> None:
    assert (await client.post("/api/folders", json={"path": "acervo/projetos/alpha"}, headers=JSON)).status_code == 201
    moved = await client.post(
        "/api/files/move", json={"source": "acervo/notas/doc.md", "destination": "acervo/projetos/alpha/doc.md"}, headers=JSON
    )
    assert moved.status_code == 200 and (root / "acervo" / "projetos" / "alpha" / "doc.md").exists()

    renamed = await client.post(
        "/api/files/move", json={"source": "acervo/projetos", "destination": "acervo/arquivo"}, headers=JSON
    )
    assert renamed.status_code == 200 and (root / "acervo" / "arquivo" / "alpha" / "doc.md").exists()

    into_itself = await client.post(
        "/api/files/move", json={"source": "acervo/arquivo", "destination": "acervo/arquivo/alpha/arquivo"}, headers=JSON
    )
    assert into_itself.status_code == 400

    not_empty = await client.delete("/api/folders", params={"path": "acervo/arquivo"}, headers=TOKEN)
    assert not_empty.status_code == 409
    removed = await client.delete("/api/folders", params={"path": "acervo/arquivo", "recursive": "true"}, headers=TOKEN)
    assert removed.status_code == 204 and not (root / "acervo" / "arquivo").exists()
    trashed = list((root / "acervo" / ".lixeira").glob("*/arquivo/alpha/doc.md"))
    assert len(trashed) == 1  # exclusão reversível


async def test_deleted_file_goes_to_hidden_trash(client: httpx.AsyncClient, root: Path) -> None:
    assert (await client.delete("/api/files", params={"path": "acervo/notas/doc.md"}, headers=TOKEN)).status_code == 204
    assert not (root / "acervo" / "notas" / "doc.md").exists()
    assert [p.read_text(encoding="utf-8") for p in (root / "acervo" / ".lixeira").glob("*/notas/doc.md")] == ["Versão inicial"]
    tree = (await client.get("/api/files/tree", headers=TOKEN)).json()["tree"]
    assert all(".lixeira" not in e["path"] for e in tree)


async def test_move_cannot_change_extension(client: httpx.AsyncClient) -> None:
    res = await client.post(
        "/api/files/move", json={"source": "acervo/notas/doc.md", "destination": "acervo/notas/doc.excalidraw"}, headers=JSON
    )
    assert res.status_code == 400


async def test_svg_asset_is_served_as_attachment(client: httpx.AsyncClient, root: Path) -> None:
    files = {"file": ("../../logo.svg", b"<svg onload='alert(1)'/>", "image/svg+xml")}
    up = await client.post("/api/assets", params={"folder": "acervo/assets"}, files=files, headers=TOKEN)
    assert up.status_code == 201 and up.json()["path"] == "acervo/assets/logo.svg"
    got = await client.get("/api/assets", params={"path": "acervo/assets/logo.svg"}, headers=TOKEN)
    assert got.headers["content-disposition"].startswith("attachment")
    assert got.headers["x-content-type-options"] == "nosniff"


async def test_upload_rejects_non_images(client: httpx.AsyncClient) -> None:
    files = {"file": ("nota.md", b"# x", "text/markdown")}
    res = await client.post("/api/assets", params={"folder": "acervo/assets"}, files=files, headers=TOKEN)
    assert res.status_code == 400


async def test_search_without_database_returns_503(client: httpx.AsyncClient) -> None:
    assert (await client.get("/api/search", params={"q": "x"}, headers=TOKEN)).status_code == 503


async def test_libraries_are_the_only_thing_at_the_root(client: httpx.AsyncClient, root: Path) -> None:
    assert (await client.get("/api/libraries", headers=TOKEN)).json() == {"libraries": ["acervo"]}
    created = await client.post("/api/libraries", json={"name": "Pesquisa 2026"}, headers=JSON)
    assert created.status_code == 201 and (root / "Pesquisa 2026").is_dir()
    assert (await client.post("/api/libraries", json={"name": "Pesquisa 2026"}, headers=JSON)).status_code == 409
    for bad in ["", ".oculta", "a/b", "../fora"]:
        assert (await client.post("/api/libraries", json={"name": bad}, headers=JSON)).status_code == 400
    assert (await client.get("/api/libraries", headers=TOKEN)).json()["libraries"] == ["acervo", "Pesquisa 2026"]


async def test_nothing_but_libraries_can_be_created_at_the_root(client: httpx.AsyncClient, root: Path) -> None:
    assert (await client.post("/api/files", json={"path": "solta.md"}, headers=JSON)).status_code == 400
    assert (await client.post("/api/folders", json={"path": "solta"}, headers=JSON)).status_code == 400
    up = await client.post("/api/assets", params={"folder": ""}, files={"file": ("a.png", b"x", "image/png")}, headers=TOKEN)
    assert up.status_code == 400
    assert not (root / "solta.md").exists() and not (root / "solta").exists()


async def test_libraries_cannot_be_moved_or_deleted(client: httpx.AsyncClient, root: Path) -> None:
    move = await client.post("/api/files/move", json={"source": "acervo", "destination": "outra"}, headers=JSON)
    assert move.status_code == 400
    delete = await client.delete("/api/folders", params={"path": "acervo", "recursive": "true"}, headers=TOKEN)
    assert delete.status_code == 400 and (root / "acervo").is_dir()


async def test_items_can_move_between_libraries(client: httpx.AsyncClient, root: Path) -> None:
    await client.post("/api/libraries", json={"name": "outra"}, headers=JSON)
    moved = await client.post(
        "/api/files/move", json={"source": "acervo/notas/doc.md", "destination": "outra/doc.md"}, headers=JSON
    )
    assert moved.status_code == 200 and (root / "outra" / "doc.md").exists()


async def test_loose_files_at_the_root_are_not_listed(client: httpx.AsyncClient, root: Path) -> None:
    (root / "solta.md").write_text("x", encoding="utf-8")
    tree = (await client.get("/api/files/tree", headers=TOKEN)).json()["tree"]
    assert "solta.md" not in [e["path"] for e in tree]


async def test_llm_settings_are_saved_without_exposing_the_token(client: httpx.AsyncClient, root: Path) -> None:
    payload = {
        "base_url": "https://api.exemplo.com/v1/",
        "api_key": "sk-segredo",
        "default_model": "modelo-x",
        "guide_prompt": "Responda em tópicos curtos.",
    }
    saved = await client.put("/api/settings/llm", json=payload, headers=JSON)
    assert saved.status_code == 200
    body = saved.json()
    assert body == {
        "base_url": "https://api.exemplo.com/v1",
        "has_api_key": True,
        "default_model": "modelo-x",
        "guide_prompt": "Responda em tópicos curtos.",
        "embedding_provider": "none",
        "embedding_model": "nomic-embed-text",
        "embedding_dim": 768,
    }
    stored = root / ".biblo" / "settings.json"
    assert oct(stored.stat().st_mode & 0o777) == "0o600"
    assert "sk-segredo" not in (await client.get("/api/settings/llm", headers=TOKEN)).text
    assert ".biblo" not in [e["path"] for e in (await client.get("/api/files/tree", headers=TOKEN)).json()["tree"]]
    assert (await client.get("/api/libraries", headers=TOKEN)).json()["libraries"] == ["acervo"]

    # api_key omitido mantém o token; "" remove.
    kept = await client.put("/api/settings/llm", json={"base_url": "http://outro/v1"}, headers=JSON)
    assert kept.json()["has_api_key"] is True
    cleared = await client.put("/api/settings/llm", json={"base_url": "http://outro/v1", "api_key": ""}, headers=JSON)
    assert cleared.json()["has_api_key"] is False


async def test_llm_settings_reject_invalid_url(client: httpx.AsyncClient) -> None:
    res = await client.put("/api/settings/llm", json={"base_url": "ftp://x"}, headers=JSON)
    assert res.status_code == 422


async def test_llm_settings_test_reports_unreachable_server(client: httpx.AsyncClient) -> None:
    res = await client.post("/api/settings/llm/test", json={"base_url": "http://127.0.0.1:9/v1"}, headers=JSON)
    assert res.status_code == 502 and "indisponível" in res.json()["detail"]


async def test_embedding_settings_are_saved_and_tested(client: httpx.AsyncClient) -> None:
    base = {"base_url": "http://127.0.0.1:9/v1"}
    saved = await client.put(
        "/api/settings/llm",
        json={**base, "embedding_provider": "chat", "embedding_model": "models/gemini-embedding-001"},
        headers=JSON,
    )
    assert saved.json()["embedding_provider"] == "chat"
    assert saved.json()["embedding_model"] == "models/gemini-embedding-001"
    kept = await client.put("/api/settings/llm", json=base, headers=JSON)
    assert kept.json()["embedding_provider"] == "chat"  # omitido = mantém

    unreachable = await client.post("/api/settings/embeddings/test", json=base, headers=JSON)
    assert unreachable.status_code == 502
    disabled = await client.post("/api/settings/embeddings/test", json={**base, "embedding_provider": "none"}, headers=JSON)
    assert disabled.status_code == 400
