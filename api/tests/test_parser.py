import json

from app.services.parser import diagram_to_text, extract_wikilinks, normalize_link_target, parse_document


def test_markdown_chunks_follow_headings_and_line_numbers() -> None:
    md = "---\ntitle: Guia\ntags: [a]\n---\n# Intro\nPrimeiro.\n\n## Arquitetura\nFastAPI e Postgres.\n"
    doc = parse_document("notas/guia.md", md)
    assert doc.title == "Guia"
    assert [c.heading for c in doc.chunks] == ["Intro", "Intro > Arquitetura"]
    assert doc.chunks[0].start_line == 5
    assert doc.chunks[1].start_line == 8
    assert "title:" not in doc.chunks[0].text  # frontmatter não vira conteúdo


def test_hash_inside_code_fence_is_not_a_heading() -> None:
    md = "# Título\n```bash\n# comentário\necho oi\n```\nfim\n"
    doc = parse_document("notas/a.md", md)
    assert len(doc.chunks) == 1
    assert "# comentário" in doc.chunks[0].text


def test_title_falls_back_to_first_h1_then_filename() -> None:
    assert parse_document("x/nota.md", "# Meu Título\ntexto").title == "Meu Título"
    assert parse_document("x/nota.md", "só texto").title == "nota"


def test_wikilinks_are_normalized_and_deduplicated() -> None:
    text = "Veja [[Bem-Vindo]], [[pasta/Outra Nota.md|alias]], [[bem-vindo#Seção]] e [[ ]]."
    assert extract_wikilinks(text) == ["bem-vindo", "pasta/outra nota"]
    assert normalize_link_target("Diagramas/Fluxo.excalidraw") == "diagramas/fluxo"


def test_max_chunks_is_enforced() -> None:
    md = "\n".join(f"## Seção {i}\nconteúdo {i}" for i in range(50))
    assert len(parse_document("n.md", md, max_chunks=10).chunks) == 10


def _excalidraw(elements: list[dict], files: dict | None = None) -> str:
    return json.dumps({"type": "excalidraw", "version": 2, "elements": elements, "files": files or {}})


def test_diagram_uses_bound_text_and_arrow_bindings() -> None:
    content = _excalidraw(
        [
            {"id": "a", "type": "rectangle", "boundElements": [{"id": "ta", "type": "text"}]},
            {"id": "ta", "type": "text", "text": "Pedido", "containerId": "a"},
            {"id": "b", "type": "diamond"},
            {"id": "tb", "type": "text", "text": "Estoque", "containerId": "b"},
            {"id": "r", "type": "arrow", "startBinding": {"elementId": "a"}, "endBinding": {"elementId": "b"}},
            {"id": "tr", "type": "text", "text": "Validação", "containerId": "r"},
            {"id": "n", "type": "text", "text": "SLA: 2 minutos, ver [[regras]]"},
            {"id": "x", "type": "rectangle", "isDeleted": True, "text": "apagado"},
        ],
        files={"img": {"dataURL": "data:image/png;base64,AAAA"}},
    )
    text, links = diagram_to_text(content)
    assert "Pedido --[Validação]--> Estoque" in text
    assert "SLA: 2 minutos" in text
    assert "apagado" not in text
    assert "base64" not in text
    assert links == ["regras"]


def test_legacy_diagram_format_still_yields_text() -> None:
    content = json.dumps({"type": "excalidraw", "elements": [{"id": "1", "type": "sticky", "text": "Ideia solta"}]})
    text, _ = diagram_to_text(content)
    assert "Ideia solta" in text


def test_invalid_diagram_json_is_empty() -> None:
    assert diagram_to_text("não é json") == ("", [])
    assert parse_document("d.excalidraw", "{}").chunks == []


def test_wikilinks_inside_code_are_ignored() -> None:
    md = "Use `[[exemplo]]` assim.\n```md\n[[outro]]\n```\nMas [[real]] vale."
    assert parse_document("n.md", md).links == ["real"]
