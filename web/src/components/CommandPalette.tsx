import { FilePlus2, FileText, Moon, PenTool, Search, Workflow } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type JSX } from "react";

import { api } from "../api/client";
import type { Citation, VaultEntry } from "../types";

interface CommandPaletteProps {
  entries: VaultEntry[];
  onClose: () => void;
  onOpenPath: (path: string, line?: number) => void;
  onNewNote: () => void;
  onNewDiagram: () => void;
  onToggleTheme: () => void;
}

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  snippet?: string;
  icon: JSX.Element;
  run: () => void;
}

export function CommandPalette({ entries, onClose, onOpenPath, onNewNote, onNewDiagram, onToggleTheme }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [hits, setHits] = useState<Citation[]>([]);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  // Busca híbrida no conteúdo (debounce de 250 ms).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setHits([]);
      setSearchNote(null);
      return;
    }
    const timer = setTimeout(() => {
      api
        .search(q, 8)
        .then((res) => {
          setHits(res.results);
          setSearchNote(res.mode === "text" ? "busca textual (sem embeddings)" : null);
        })
        .catch((err) => {
          setHits([]);
          setSearchNote(err instanceof Error ? err.message : "busca indisponível");
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const close = (fn: () => void) => () => (onClose(), fn());
    const files: Item[] = entries
      .filter((e) => e.type === "file" && e.kind !== "asset" && (!q || e.path.toLowerCase().includes(q)))
      .slice(0, 8)
      .map((e) => ({
        id: `file:${e.path}`,
        group: "Arquivos",
        label: e.name,
        hint: e.path,
        icon: e.kind === "diagram" ? <PenTool size={14} aria-hidden="true" /> : <FileText size={14} aria-hidden="true" />,
        run: close(() => onOpenPath(e.path)),
      }));
    const content: Item[] = hits.map((h) => ({
      id: `hit:${h.chunk_id}`,
      group: "No conteúdo",
      label: h.heading ? `${h.title} › ${h.heading}` : h.title,
      hint: `${h.path}:${h.start_line}`,
      snippet: h.snippet,
      icon: <Search size={14} aria-hidden="true" />,
      run: close(() => onOpenPath(h.path, h.kind === "markdown" ? h.start_line : undefined)),
    }));
    const commands: Item[] = [
      { id: "cmd:note", group: "Comandos", label: "Nova nota", icon: <FilePlus2 size={14} aria-hidden="true" />, run: close(onNewNote) },
      { id: "cmd:diagram", group: "Comandos", label: "Novo diagrama", icon: <Workflow size={14} aria-hidden="true" />, run: close(onNewDiagram) },
      { id: "cmd:theme", group: "Comandos", label: "Alternar tema claro/escuro", icon: <Moon size={14} aria-hidden="true" />, run: close(onToggleTheme) },
    ].filter((c) => !q || c.label.toLowerCase().includes(q));
    return [...files, ...content, ...commands];
  }, [entries, hits, query, onClose, onOpenPath, onNewNote, onNewDiagram, onToggleTheme]);

  useEffect(() => setSelected(0), [query]);

  return (
    <div className="overlay command" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="command-palette" role="dialog" aria-modal="true" aria-label="Busca e comandos">
        <div className="command-input-wrapper">
          <Search size={16} aria-hidden="true" />
          <input
            ref={inputRef}
            className="command-input"
            placeholder="Buscar arquivos, conteúdo ou comandos…"
            aria-label="Buscar"
            aria-controls="command-results"
            aria-activedescendant={items[selected]?.id}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") (e.preventDefault(), setSelected((s) => Math.min(s + 1, items.length - 1)));
              else if (e.key === "ArrowUp") (e.preventDefault(), setSelected((s) => Math.max(s - 1, 0)));
              else if (e.key === "Enter") items[selected]?.run();
            }}
          />
          <span className="kbd">Esc</span>
        </div>
        <ul id="command-results" className="command-results" role="listbox">
          {items.map((item, i) => (
            <li key={item.id} id={item.id} role="option" aria-selected={i === selected}>
              {(i === 0 || items[i - 1].group !== item.group) && (
                <div className="command-group">
                  {item.group}
                  {item.group === "No conteúdo" && searchNote ? ` · ${searchNote}` : ""}
                </div>
              )}
              <div className={`command-item ${i === selected ? "selected" : ""}`} onMouseEnter={() => setSelected(i)} onClick={item.run}>
                <span className="tree-item-label">
                  {item.icon}
                  <span>
                    {item.label}
                    {item.snippet && <span className="command-snippet">{item.snippet}</span>}
                  </span>
                </span>
                {item.hint && <span className="command-hint">{item.hint}</span>}
              </div>
            </li>
          ))}
          {items.length === 0 && <li className="command-group">Nada encontrado{searchNote ? ` · ${searchNote}` : ""}.</li>}
        </ul>
      </div>
    </div>
  );
}
