"""Transforma notas e diagramas das bibliotecas em chunks indexáveis e links."""

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

HEADING_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
FENCE_RE = re.compile(r"^\s*(```|~~~)")
WIKILINK_RE = re.compile(r"\[\[([^\[\]|#]+)(?:#[^\[\]|]*)?(?:\|[^\[\]]*)?\]\]")
FRONTMATTER_TITLE_RE = re.compile(r"^title:\s*[\"']?(.+?)[\"']?\s*$", re.MULTILINE)
SHAPE_TYPES = {"rectangle", "ellipse", "diamond", "frame", "magicframe", "image", "embeddable"}


@dataclass
class Chunk:
    ordinal: int
    heading: str
    start_line: int
    end_line: int
    text: str


@dataclass
class ParsedDocument:
    kind: str
    title: str
    chunks: list[Chunk]
    links: list[str] = field(default_factory=list)


def normalize_link_target(raw: str) -> str:
    """'Pasta/Minha Nota.md' -> 'pasta/minha nota' (chave de resolução de wikilinks)."""
    target = raw.strip().replace("\\", "/").strip("/").lower()
    return re.sub(r"\.(md|markdown|excalidraw)$", "", target)


CODE_FENCE_BLOCK_RE = re.compile(r"^\s*(```|~~~).*?^\s*\1", re.MULTILINE | re.DOTALL)
INLINE_CODE_RE = re.compile(r"(`+)(?!`).+?(?<!`)\1(?!`)", re.DOTALL)


def strip_code(text: str) -> str:
    """Remove blocos e trechos de código: [[...]] dentro de código é exemplo, não link."""
    return INLINE_CODE_RE.sub("", CODE_FENCE_BLOCK_RE.sub("", text))


def extract_wikilinks(text: str) -> list[str]:
    seen: dict[str, None] = {}
    for match in WIKILINK_RE.finditer(text):
        target = normalize_link_target(match.group(1))
        if target:
            seen.setdefault(target, None)
    return list(seen)


def _split_frontmatter(lines: list[str]) -> tuple[str, int]:
    """Devolve (frontmatter, índice da primeira linha do corpo)."""
    if lines and lines[0].strip() == "---":
        for idx in range(1, len(lines)):
            if lines[idx].strip() in ("---", "..."):
                return "\n".join(lines[1:idx]), idx + 1
    return "", 0


def parse_markdown(text: str, fallback_title: str, max_chunk_chars: int = 1500) -> ParsedDocument:
    lines = text.splitlines()
    frontmatter, body_start = _split_frontmatter(lines)

    title = ""
    if frontmatter and (m := FRONTMATTER_TITLE_RE.search(frontmatter)):
        title = m.group(1).strip()

    chunks: list[Chunk] = []
    heading_stack: list[str] = []
    buffer: list[str] = []
    start_line = body_start + 1
    in_fence = False

    def flush(end_line: int) -> None:
        nonlocal buffer
        chunk_text = "\n".join(buffer).strip()
        if chunk_text:
            chunks.append(Chunk(len(chunks), " > ".join(heading_stack), start_line, end_line, chunk_text))
        buffer = []

    for idx in range(body_start, len(lines)):
        line_no = idx + 1
        line = lines[idx]
        if FENCE_RE.match(line):
            in_fence = not in_fence
        heading = None if in_fence else HEADING_RE.match(line)
        if heading:
            flush(line_no - 1)
            level = len(heading.group(1))
            heading_stack[:] = heading_stack[: level - 1] + [heading.group(2).strip()]
            if not title and level == 1:
                title = heading.group(2).strip()
            start_line = line_no
            buffer.append(line)
            continue
        buffer.append(line)
        if not in_fence and len("\n".join(buffer)) >= max_chunk_chars and line.strip() == "":
            flush(line_no)
            start_line = line_no + 1
    flush(len(lines))

    return ParsedDocument("markdown", title or fallback_title, chunks, extract_wikilinks(strip_code(text)))


def _element_label(element: dict[str, Any], bound_text: dict[str, str]) -> str:
    """Texto visível de um elemento: texto ligado (containerId) ou rótulo próprio."""
    label = bound_text.get(element.get("id", ""), "")
    if not label:
        # Compatível com arquivos legados que gravavam o texto direto na forma.
        label = str(element.get("text") or element.get("name") or "").strip()
    return " ".join(label.split())


def diagram_to_text(json_content: str) -> tuple[str, list[str]]:
    """Traduz um .excalidraw em grafo textual legível por LLM.

    Ignora a chave "files" (imagens base64) e elementos deletados.
    """
    try:
        data = json.loads(json_content)
    except json.JSONDecodeError:
        return "", []
    elements = data.get("elements") if isinstance(data, dict) else None
    if not isinstance(elements, list):
        return "", []

    alive = [e for e in elements if isinstance(e, dict) and not e.get("isDeleted")]
    bound_text: dict[str, str] = {}
    for el in alive:
        if el.get("type") == "text" and el.get("containerId"):
            text = str(el.get("text") or el.get("originalText") or "").strip()
            if text:
                bound_text[el["containerId"]] = (bound_text.get(el["containerId"], "") + " " + text).strip()

    by_id = {el.get("id"): el for el in alive}
    nodes: list[str] = []
    flows: list[str] = []
    notes: list[str] = []
    frames: list[str] = []

    for el in alive:
        el_type = el.get("type")
        if el_type in ("arrow", "line"):
            start = by_id.get((el.get("startBinding") or {}).get("elementId"))
            end = by_id.get((el.get("endBinding") or {}).get("elementId"))
            if start and end:
                a, b = _element_label(start, bound_text), _element_label(end, bound_text)
                label = _element_label(el, bound_text)
                if a and b:
                    flows.append(f"{a} --[{label}]--> {b}" if label else f"{a} --> {b}")
        elif el_type in ("frame", "magicframe"):
            if name := _element_label(el, bound_text):
                frames.append(name)
        elif el_type == "text" and not el.get("containerId"):
            if text := _element_label(el, bound_text):
                notes.append(text)
        elif el_type in SHAPE_TYPES or el_type not in ("text", "freedraw"):
            if label := _element_label(el, bound_text):
                nodes.append(label)

    parts = []
    if frames:
        parts.append("Seções: " + "; ".join(frames))
    if flows:
        parts.append("Fluxo:\n" + "\n".join(flows))
    if nodes:
        parts.append("Elementos: " + "; ".join(dict.fromkeys(nodes)))
    if notes:
        parts.append("Anotações: " + "; ".join(notes))
    text = "\n".join(parts)
    return text, extract_wikilinks(text)


def parse_document(path: str, content: str, max_chunks: int = 100, max_chunk_chars: int = 1500) -> ParsedDocument:
    stem = Path(path).stem
    if path.lower().endswith(".excalidraw"):
        text, links = diagram_to_text(content)
        chunks = [Chunk(0, "Diagrama", 1, 1, text)] if text else []
        parsed = ParsedDocument("diagram", stem, chunks, links)
    else:
        parsed = parse_markdown(content, stem, max_chunk_chars=max_chunk_chars)
    parsed.chunks = parsed.chunks[:max_chunks]
    return parsed
