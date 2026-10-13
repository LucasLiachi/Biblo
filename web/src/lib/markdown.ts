import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";

import { api } from "../api/client";

const WIKILINK = /\[\[([^[\]|#]+)(#[^[\]|]*)?(?:\|([^[\]]+))?\]\]/g;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function createRenderer(): MarkdownIt {
  // html: false — HTML bruto dentro das notas nunca vira DOM.
  const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

  md.core.ruler.after("inline", "wikilinks", (state) => {
    for (const block of state.tokens) {
      if (block.type !== "inline" || !block.children) continue;
      const out = [];
      for (const token of block.children) {
        if (token.type !== "text" || !token.content.includes("[[")) {
          out.push(token);
          continue;
        }
        let last = 0;
        for (const m of token.content.matchAll(WIKILINK)) {
          if (m.index! > last) {
            const t = new state.Token("text", "", 0);
            t.content = token.content.slice(last, m.index);
            out.push(t);
          }
          const html = new state.Token("html_inline", "", 0);
          const target = m[1].trim();
          const label = (m[3] ?? m[1] + (m[2] ?? "")).trim();
          html.content = `<a class="wikilink" href="#" data-wikilink="${escapeHtml(target)}">${escapeHtml(label)}</a>`;
          out.push(html);
          last = m.index! + m[0].length;
        }
        if (last < token.content.length) {
          const t = new state.Token("text", "", 0);
          t.content = token.content.slice(last);
          out.push(t);
        }
      }
      block.children = out;
    }
  });

  // Checklists: "- [ ] tarefa" vira caixa clicável que aponta para a linha da fonte.
  md.core.ruler.after("inline", "tasks", (state) => {
    const offset = (state.env as { lineOffset?: number }).lineOffset ?? 0;
    state.tokens.forEach((block, i) => {
      if (block.type !== "inline" || !block.map || state.tokens[i - 2]?.type !== "list_item_open") return;
      const first = block.children?.[0];
      const m = first?.type === "text" ? /^\[([ xX])\]\s+/.exec(first.content) : null;
      if (!first || !m) return;
      const checked = m[1] !== " ";
      first.content = first.content.slice(m[0].length);
      const box = new state.Token("html_inline", "", 0);
      box.content =
        `<span class="task-box" role="checkbox" tabindex="0" aria-checked="${checked}" ` +
        `data-task-line="${block.map[0] + offset}">${checked ? "☑" : "☐"}</span> `;
      block.children!.unshift(box);
    });
  });

  // Mermaid vira um contêiner; o componente de preview renderiza depois (lazy).
  const fence = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (token.info.trim() === "mermaid") {
      // Código vai como texto (não atributo): o DOMPurify descarta atributos com "-->".
      return `<div class="mermaid-block"><pre class="mermaid-source" hidden>${escapeHtml(token.content)}</pre></div>`;
    }
    return fence(tokens, idx, options, env, self);
  };

  // Imagens só da biblioteca: caminhos relativos viram /api/assets; URLs externas são bloqueadas.
  const image = md.renderer.rules.image!;
  md.renderer.rules.image = (tokens, idx, options, env: { library?: string }, self) => {
    const token = tokens[idx];
    const src = token.attrGet("src") ?? "";
    if (/^[a-z]+:/i.test(src) || src.startsWith("//")) {
      return `<span class="blocked-image" title="Imagem externa bloqueada">[imagem externa bloqueada]</span>`;
    }
    const relative = src.replace(/^\.?\//, "");
    token.attrSet("src", api.assetUrl(env.library ? `${env.library}/${relative}` : relative));
    return image(tokens, idx, options, env, self);
  };

  // Links externos abrem fora e sem referrer.
  md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
    const href = tokens[idx].attrGet("href") ?? "";
    if (/^https?:/i.test(href)) {
      tokens[idx].attrSet("target", "_blank");
      tokens[idx].attrSet("rel", "noopener noreferrer");
    }
    return self.renderToken(tokens, idx, options);
  };
  return md;
}

const renderer = createRenderer();

DOMPurify.addHook("uponSanitizeElement", (node, data) => {
  if (data.tagName === "img") {
    const src = (node as Element).getAttribute("src") ?? "";
    if (!src.startsWith("/api/assets?") && !src.startsWith("data:image/")) node.parentNode?.removeChild(node);
  }
});

// URIs seguem a regra padrão do DOMPurify (bloqueia javascript: e afins); imagens têm o filtro acima.
const PURIFY = {
  ADD_ATTR: ["data-wikilink", "data-task-line", "target", "tabindex"],
  FORBID_TAGS: ["style", "form", "input", "iframe"],
};

/** Markdown da biblioteca -> HTML seguro (sem HTML bruto, sem scripts, sem imagens externas).
 *  Imagens relativas (`assets/x.png`) são resolvidas dentro de `library`. */
export function renderMarkdown(source: string, library?: string): string {
  const frontmatter = /^---\n[\s\S]*?\n(---|\.\.\.)\n/.exec(source)?.[0] ?? "";
  const lineOffset = frontmatter ? frontmatter.split("\n").length - 1 : 0;
  return DOMPurify.sanitize(renderer.render(source.slice(frontmatter.length), { lineOffset, library }), PURIFY);
}

/** Alterna "- [ ]" / "- [x]" na linha (base 0) indicada pelo preview. */
export function toggleTask(source: string, line: number): string {
  const lines = source.split("\n");
  if (line < 0 || line >= lines.length) return source;
  lines[line] = lines[line].replace(/\[( |x|X)\]/, (_m, mark: string) => (mark === " " ? "[x]" : "[ ]"));
  return lines.join("\n");
}

/** Resposta do chat: mesmo pipeline, sem imagens nenhuma. */
export function renderChatMarkdown(source: string): string {
  return DOMPurify.sanitize(renderer.render(source), { ...PURIFY, FORBID_TAGS: [...PURIFY.FORBID_TAGS, "img"] });
}

export interface OutlineItem {
  level: number;
  text: string;
  line: number;
}

export function extractOutline(source: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  let inFence = false;
  source.split("\n").forEach((line, idx) => {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const m = !inFence && /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) items.push({ level: m[1].length, text: m[2], line: idx + 1 });
  });
  return items;
}
