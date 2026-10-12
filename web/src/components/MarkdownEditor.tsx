import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { EditorSelection, EditorState } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  drawSelection,
  highlightActiveLine,
  keymap,
  lineNumbers,
  placeholder,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import {
  Bold,
  Code,
  Columns2,
  Eye,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListTree,
  PencilLine,
  Table,
  Workflow,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "../api/client";
import { extractOutline, toggleTask } from "../lib/markdown";
import { stripExtension } from "../lib/vault";
import type { LinksInfo, OpenDocument, VaultEntry } from "../types";
import { Breadcrumb } from "./Breadcrumb";
import { MarkdownPreview } from "./MarkdownPreview";

type Mode = "edit" | "split" | "preview";
const MODE_KEY = "biblo.editor.mode";

interface MarkdownEditorProps {
  doc: OpenDocument;
  entries: VaultEntry[];
  theme: "dark" | "light";
  jumpTo?: { line: number; nonce: number } | null;
  onChange: (path: string, content: string) => void;
  onOpenLink: (target: string) => void;
  onOpenPath: (path: string) => void;
}

const highlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: "700", fontSize: "1.35em", color: "var(--foreground)" },
  { tag: tags.heading2, fontWeight: "700", fontSize: "1.2em", color: "var(--foreground)" },
  { tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], fontWeight: "600", color: "var(--foreground)" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: [tags.link, tags.url], color: "var(--accent-wikilink-fg)" },
  { tag: tags.monospace, color: "var(--accent-canvas-fg)" },
  { tag: tags.quote, color: "var(--muted-foreground)", fontStyle: "italic" },
  { tag: [tags.processingInstruction, tags.meta, tags.contentSeparator], color: "var(--muted)" },
  { tag: tags.list, color: "var(--accent-primary-fg)" },
]);

const WIKILINK_RE = /\[\[([^[\]\n|#]+)(?:#[^[\]\n|]*)?(?:\|[^[\]\n]*)?\]\]/g;

const wikilinkDecorator = new MatchDecorator({
  regexp: WIKILINK_RE,
  decoration: () => Decoration.mark({ class: "cm-wikilink" }),
});

const wikilinkHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = wikilinkDecorator.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = wikilinkDecorator.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);

function wikilinkAt(view: EditorView, pos: number): string | null {
  const line = view.state.doc.lineAt(pos);
  for (const m of line.text.matchAll(WIKILINK_RE)) {
    const from = line.from + m.index!;
    if (pos >= from && pos <= from + m[0].length) return m[1].trim();
  }
  return null;
}

function wrapSelection(view: EditorView, before: string, after = before, fallback = "texto") {
  view.dispatch(
    view.state.changeByRange((range) => {
      const text = view.state.sliceDoc(range.from, range.to) || fallback;
      return {
        changes: { from: range.from, to: range.to, insert: `${before}${text}${after}` },
        range: EditorSelection.range(range.from + before.length, range.from + before.length + text.length),
      };
    }),
  );
  view.focus();
}

function prefixLines(view: EditorView, prefix: string) {
  const changes = [];
  const seen = new Set<number>();
  for (const range of view.state.selection.ranges) {
    for (let pos = range.from; pos <= range.to; ) {
      const line = view.state.doc.lineAt(pos);
      if (!seen.has(line.number)) {
        seen.add(line.number);
        changes.push({ from: line.from, insert: prefix });
      }
      pos = line.to + 1;
    }
  }
  view.dispatch({ changes });
  view.focus();
}

function insertBlock(view: EditorView, block: string) {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const prefix = line.text.trim() ? "\n\n" : "";
  view.dispatch({ changes: { from: line.to, insert: `${prefix}${block}\n` }, selection: { anchor: line.to + prefix.length + block.length } });
  view.focus();
}

const TABLE = "| Coluna | Coluna |\n| --- | --- |\n| valor | valor |";
const FLOWCHART = "```mermaid\nflowchart LR\n  A[Ideia] --> B{Decisão}\n  B -->|sim| C[Nota]\n  B -->|não| D[Diagrama]\n```";

export function MarkdownEditor({ doc, entries, theme, jumpTo, onChange, onOpenLink, onOpenPath }: MarkdownEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>(() => {
    try {
      return (localStorage.getItem(MODE_KEY) as Mode) || "edit";
    } catch {
      return "edit";
    }
  });
  const [showSide, setShowSide] = useState(true);
  const [links, setLinks] = useState<LinksInfo | null>(null);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });

  // Refs para os callbacks não recriarem o editor a cada render.
  const latest = useRef({ onChange, onOpenLink, entries, path: doc.path });
  latest.current = { onChange, onOpenLink, entries, path: doc.path };

  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      /* sem armazenamento: o modo volta ao padrão no próximo carregamento */
    }
  }, [mode]);

  // Cria o editor por documento (path). Trocas externas de conteúdo chegam por `revision`.
  useEffect(() => {
    if (!host.current) return;
    const linkCompletion = (ctx: CompletionContext): CompletionResult | null => {
      const match = ctx.matchBefore(/\[\[[^\]\n]*/);
      if (!match) return null;
      const options = latest.current.entries
        .filter((e) => e.type === "file" && e.kind !== "asset")
        .map((e) => ({
          label: stripExtension(e.name),
          detail: e.path,
          type: e.kind === "diagram" ? "class" : "text",
          apply: `${stripExtension(e.name)}]]`,
        }));
      return { from: match.from + 2, options, validFor: /^[^\]\n]*$/ };
    };

    const state = EditorState.create({
      doc: doc.content,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        search({ top: true }),
        EditorView.lineWrapping,
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(highlight),
        wikilinkHighlighter,
        autocompletion({ override: [linkCompletion], icons: false }),
        placeholder("Escreva em Markdown. Use [[ para ligar outra nota."),
        keymap.of([
          { key: "Mod-b", run: (v) => (wrapSelection(v, "**"), true) },
          { key: "Mod-i", run: (v) => (wrapSelection(v, "*"), true) },
          { key: "Mod-e", run: (v) => (wrapSelection(v, "`"), true) },
          indentWithTab,
          ...searchKeymap,
          ...historyKeymap,
          ...defaultKeymap,
        ]),
        EditorView.domEventHandlers({
          mousedown(event, v) {
            if (!(event.ctrlKey || event.metaKey)) return false;
            const pos = v.posAtCoords({ x: event.clientX, y: event.clientY });
            const target = pos === null ? null : wikilinkAt(v, pos);
            if (!target) return false;
            event.preventDefault();
            latest.current.onOpenLink(target);
            return true;
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) latest.current.onChange(latest.current.path, update.state.doc.toString());
          if (update.selectionSet || update.docChanged) {
            const head = update.state.selection.main.head;
            const line = update.state.doc.lineAt(head);
            setCursor({ line: line.number, col: head - line.from + 1 });
          }
        }),
        EditorView.contentAttributes.of({ "aria-label": `Editor de ${doc.name}`, spellcheck: "true", lang: "pt-BR" }),
      ],
    });
    const editor = new EditorView({ state, parent: host.current });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.path, mode === "preview"]);

  // Conteúdo trocado por fora (disco, resolução de conflito).
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== doc.content) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: doc.content } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.revision]);

  useEffect(() => {
    const v = view.current;
    if (!jumpTo || !v) return;
    const line = v.state.doc.line(Math.min(Math.max(jumpTo.line, 1), v.state.doc.lines));
    v.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: "start", yMargin: 40 }) });
    v.focus();
  }, [jumpTo]);

  // Backlinks: recarrega quando o documento troca ou acaba de ser gravado (o índice já atualizou).
  useEffect(() => {
    if (doc.state !== "saved") return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .links(doc.path)
        .then((info) => !cancelled && (setLinks(info), setLinksError(null)))
        .catch((err) => !cancelled && setLinksError(err instanceof Error ? err.message : "Índice indisponível."));
    }, 1200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [doc.path, doc.state, doc.etag]);

  const outline = useMemo(() => extractOutline(doc.content), [doc.content]);
  const words = useMemo(() => (doc.content.match(/[\p{L}\p{N}]+/gu) ?? []).length, [doc.content]);

  const act = (fn: (v: EditorView) => void) => () => view.current && fn(view.current);

  const uploadImage = async (file: File) => {
    const path = await api.uploadAsset(file);
    view.current && insertBlock(view.current, `![${stripExtension(file.name)}](${path})`);
  };

  const stateLabel: Record<OpenDocument["state"], string> = {
    saved: "Gravado no vault",
    dirty: "Alterado…",
    saving: "Gravando…",
    conflict: "Conflito com o disco",
    error: doc.error ?? "Falha ao gravar",
  };

  return (
    <>
      <div className="doc-bar">
        <Breadcrumb path={doc.path} />
        <div className="toolbar" role="toolbar" aria-label="Formatação">
          {mode !== "preview" && (
            <>
              <button type="button" className="btn btn-ghost btn-icon" title="Negrito (Ctrl+B)" aria-label="Negrito" onClick={act((v) => wrapSelection(v, "**"))}><Bold size={15} /></button>
              <button type="button" className="btn btn-ghost btn-icon" title="Itálico (Ctrl+I)" aria-label="Itálico" onClick={act((v) => wrapSelection(v, "*"))}><Italic size={15} /></button>
              <button type="button" className="btn btn-ghost btn-icon" title="Título" aria-label="Título" onClick={act((v) => prefixLines(v, "## "))}><Heading2 size={15} /></button>
              <button type="button" className="btn btn-ghost btn-icon" title="Lista" aria-label="Lista" onClick={act((v) => prefixLines(v, "- "))}><List size={15} /></button>
              <button type="button" className="btn btn-ghost btn-icon" title="Tarefa" aria-label="Tarefa" onClick={act((v) => prefixLines(v, "- [ ] "))}><ListChecks size={15} /></button>
              <button type="button" className="btn btn-ghost btn-icon" title="Código (Ctrl+E)" aria-label="Código" onClick={act((v) => wrapSelection(v, "`"))}><Code size={15} /></button>
              <button type="button" className="btn btn-ghost btn-icon" title="Link para nota [[ ]]" aria-label="Wikilink" onClick={act((v) => wrapSelection(v, "[[", "]]", "nota"))}><Link2 size={15} /></button>
              <button type="button" className="btn btn-ghost btn-icon" title="Tabela" aria-label="Tabela" onClick={act((v) => insertBlock(v, TABLE))}><Table size={15} /></button>
              <button type="button" className="btn btn-ghost btn-icon" title="Fluxograma Mermaid" aria-label="Fluxograma" onClick={act((v) => insertBlock(v, FLOWCHART))}><Workflow size={15} /></button>
              <button type="button" className="btn btn-ghost btn-icon" title="Imagem do vault" aria-label="Inserir imagem" onClick={() => fileInput.current?.click()}><ImagePlus size={15} /></button>
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadImage(f); }} />
              <span className="toolbar-separator" />
            </>
          )}
          <div className="view-mode-selector" role="radiogroup" aria-label="Modo de visualização">
            {([["edit", PencilLine, "Editar"], ["split", Columns2, "Dividido"], ["preview", Eye, "Visualizar"]] as const).map(([id, Icon, label]) => (
              <button key={id} type="button" role="radio" aria-checked={mode === id} className={`view-mode-btn ${mode === id ? "active" : ""}`} onClick={() => setMode(id)} title={label}>
                <Icon size={13} aria-hidden="true" /> <span className="mode-label">{label}</span>
              </button>
            ))}
          </div>
          <button type="button" className={`btn btn-ghost btn-icon ${showSide ? "active" : ""}`} title="Estrutura e backlinks" aria-label="Estrutura e backlinks" aria-pressed={showSide} onClick={() => setShowSide((s) => !s)}>
            <ListTree size={15} />
          </button>
        </div>
      </div>

      <div className="editor-layout">
        <div className={`editor-main ${mode === "split" ? "split" : ""}`}>
          {mode !== "preview" && <div className="cm-host" ref={host} />}
          {mode !== "edit" && (
            <MarkdownPreview
              source={doc.content}
              theme={theme}
              onOpenLink={onOpenLink}
              onToggleTask={(line) => {
                const next = toggleTask(doc.content, line);
                const v = view.current;
                if (v) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: next } });
                else onChange(doc.path, next);
              }}
            />
          )}
        </div>
        {showSide && (
          <aside className="side-panel" aria-label="Estrutura e conexões">
            <section>
              <h3>Estrutura</h3>
              {outline.length ? (
                <ul>
                  {outline.map((item) => (
                    <li key={`${item.line}-${item.text}`} style={{ paddingLeft: `${(item.level - 1) * 10}px` }}>
                      <button type="button" onClick={() => view.current && (view.current.dispatch({ selection: { anchor: view.current.state.doc.line(item.line).from }, effects: EditorView.scrollIntoView(view.current.state.doc.line(item.line).from, { y: "start" }) }), view.current.focus())}>
                        {item.text}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty">Sem títulos.</p>
              )}
            </section>
            <section>
              <h3>Backlinks</h3>
              {linksError ? (
                <p className="empty">{linksError}</p>
              ) : links?.backlinks.length ? (
                <ul>
                  {links.backlinks.map((b) => (
                    <li key={b.path}><button type="button" title={b.path} onClick={() => onOpenPath(b.path)}>{b.title}</button></li>
                  ))}
                </ul>
              ) : (
                <p className="empty">Nenhuma nota aponta para esta.</p>
              )}
            </section>
            <section>
              <h3>Links de saída</h3>
              {links?.outgoing.length ? (
                <ul>
                  {links.outgoing.map((o) => (
                    <li key={o.target}>
                      <button type="button" className={o.path ? "" : "missing"} title={o.path ?? "Nota ainda não existe: clique para criar"} onClick={() => onOpenLink(o.target)}>
                        {o.target}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty">Sem [[wikilinks]].</p>
              )}
            </section>
          </aside>
        )}
      </div>

      <div className="doc-status" aria-live="polite">
        <span className={`state-${doc.state}`}>{stateLabel[doc.state]}</span>
        {mode !== "preview" && <span>Ln {cursor.line}, Col {cursor.col}</span>}
        <span>{words} palavras</span>
        <span>Markdown</span>
      </div>
    </>
  );
}
