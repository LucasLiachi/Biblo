import {
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Image,
  Library,
  LibraryBig,
  PenTool,
  Workflow,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type JSX, type MouseEvent } from "react";

import { buildTree, parentOf } from "../lib/paths";
import type { LibraryEntry, TreeNode } from "../types";

export interface LibraryActions {
  open: (path: string) => void;
  newLibrary: () => void;
  newNote: (folder: string) => void;
  newDiagram: (folder: string) => void;
  newFolder: (folder: string) => void;
  rename: (entry: LibraryEntry) => void;
  move: (source: string, targetFolder: string) => void;
  remove: (entry: LibraryEntry) => void;
}

interface LibraryTreeProps {
  entries: LibraryEntry[];
  activePath?: string;
  error?: string | null;
  actions: LibraryActions;
}

interface MenuState {
  x: number;
  y: number;
  entry: LibraryEntry | null; // null = área das bibliotecas (só permite criar biblioteca)
}

const EXPANDED_KEY = "biblo.libraries.expanded";
const DRAG_TYPE = "application/x-biblo-path";

function loadExpanded(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function FileIcon({ node }: { node: LibraryEntry }) {
  if (node.kind === "diagram") return <PenTool size={14} className="tree-icon tree-icon-canvas" aria-hidden="true" />;
  if (node.kind === "asset") return <Image size={14} className="tree-icon" aria-hidden="true" />;
  return <FileText size={14} className="tree-icon tree-icon-md" aria-hidden="true" />;
}

export function LibraryTree({ entries, activePath, error, actions }: LibraryTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(loadExpanded);
  const [filter, setFilter] = useState("");
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const tree = useMemo(() => buildTree(entries), [entries]);

  useEffect(() => {
    try {
      localStorage.setItem(EXPANDED_KEY, JSON.stringify([...expanded]));
    } catch {
      /* armazenamento indisponível: só não lembra as pastas abertas */
    }
  }, [expanded]);

  // Revela o arquivo ativo abrindo biblioteca e pastas ancestrais.
  useEffect(() => {
    if (!activePath) return;
    const parents: string[] = [];
    for (let p = parentOf(activePath); p; p = parentOf(p)) parents.push(p);
    if (parents.some((p) => !expanded.has(p))) setExpanded((prev) => new Set([...prev, ...parents]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath]);

  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector("button")?.focus();
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof globalThis.MouseEvent && menuRef.current?.contains(e.target as Node)) return;
      setMenu(null);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [menu]);

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const query = filter.trim().toLowerCase();
  const matches = (node: TreeNode): boolean =>
    !query || node.type === "library" || node.name.toLowerCase().includes(query) || node.children.some(matches);

  const openMenu = (e: MouseEvent, entry: LibraryEntry | null) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: Math.min(e.clientX, window.innerWidth - 220), y: Math.min(e.clientY, window.innerHeight - 220), entry });
  };

  // Itens dentro de bibliotecas são arrastáveis; bibliotecas são só destino.
  const dropProps = (folder: string) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(folder);
    },
    onDragLeave: () => setDropTarget((t) => (t === folder ? null : t)),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(null);
      const source = e.dataTransfer.getData(DRAG_TYPE);
      if (source && source !== folder && parentOf(source) !== folder && !folder.startsWith(`${source}/`)) {
        actions.move(source, folder);
      }
    },
  });

  const renderNode = (node: TreeNode, depth: number): JSX.Element | null => {
    if (!matches(node)) return null;
    const isLibrary = node.type === "library";
    const isFolder = node.type !== "file";
    const isOpen = isFolder && (expanded.has(node.path) || !!query);
    const style = { "--depth": depth } as CSSProperties;
    const FolderIcon = isOpen ? FolderOpen : Folder;
    return (
      <li key={node.path} role="treeitem" aria-expanded={isFolder ? isOpen : undefined} aria-selected={node.path === activePath}>
        <div
          className={`tree-item tree-row ${isLibrary ? "tree-library" : ""} ${node.path === activePath ? "active" : ""} ${dropTarget === node.path ? "drop-target" : ""}`}
          style={style}
          draggable={!isLibrary}
          tabIndex={0}
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_TYPE, node.path);
            e.dataTransfer.effectAllowed = "move";
          }}
          {...(isFolder ? dropProps(node.path) : {})}
          onClick={() => (isFolder ? toggle(node.path) : node.kind !== "asset" && actions.open(node.path))}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (isFolder) toggle(node.path);
              else if (node.kind !== "asset") actions.open(node.path);
            } else if (e.key === "F2" && !isLibrary) actions.rename(node);
            else if (e.key === "Delete" && !isLibrary) actions.remove(node);
            else if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setMenu({ x: rect.left + 24, y: rect.bottom, entry: node });
            }
          }}
          onContextMenu={(e) => openMenu(e, node)}
          title={node.path}
        >
          <span className="tree-item-label">
            {isFolder && (isOpen ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />)}
            {isLibrary ? (
              <Library size={14} className="tree-icon tree-icon-library" aria-hidden="true" />
            ) : isFolder ? (
              <FolderIcon size={14} className="tree-icon tree-icon-folder" aria-hidden="true" />
            ) : (
              <FileIcon node={node} />
            )}
            <span>{node.name}</span>
          </span>
          {isFolder && (
            <span className="tree-actions">
              <button type="button" className="btn btn-ghost btn-icon" title="Nova nota aqui" aria-label={`Nova nota em ${node.name}`}
                onClick={(e) => { e.stopPropagation(); actions.newNote(node.path); }}>
                <FilePlus2 size={13} />
              </button>
              <button type="button" className="btn btn-ghost btn-icon" title="Novo diagrama aqui" aria-label={`Novo diagrama em ${node.name}`}
                onClick={(e) => { e.stopPropagation(); actions.newDiagram(node.path); }}>
                <Workflow size={13} />
              </button>
            </span>
          )}
        </div>
        {isFolder && isOpen && node.children.length > 0 && (
          <ul className="tree-list" role="group">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </ul>
        )}
        {isLibrary && isOpen && node.children.length === 0 && !query && (
          <p className="chat-meta tree-empty" style={{ "--depth": depth + 1 } as CSSProperties}>Biblioteca vazia.</p>
        )}
      </li>
    );
  };

  const menuEntry = menu?.entry ?? null;
  const menuFolder = menuEntry ? (menuEntry.type === "file" ? parentOf(menuEntry.path) : menuEntry.path) : "";

  return (
    <nav className="library-tree" aria-label="Bibliotecas">
      <div className="tree-header">
        <span>Bibliotecas</span>
        <button type="button" className="btn btn-ghost btn-icon" title="Nova biblioteca" aria-label="Nova biblioteca" onClick={actions.newLibrary}>
          <LibraryBig size={15} />
        </button>
      </div>
      <input
        className="tree-filter"
        type="search"
        placeholder="Filtrar arquivos…"
        aria-label="Filtrar arquivos das bibliotecas"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {error && <div className="tree-error" role="alert">{error}</div>}
      <div className="tree-scroll" onContextMenu={(e) => openMenu(e, null)}>
        <ul className="tree-list" role="tree" aria-label="Bibliotecas">
          {tree.map((node) => renderNode(node, 0))}
        </ul>
        {tree.length === 0 && !error && (
          <div className="tree-onboarding">
            <p className="chat-meta">Crie uma biblioteca para reunir notas e diagramas de um mesmo assunto.</p>
            <button type="button" className="btn btn-primary" onClick={actions.newLibrary}>
              <LibraryBig size={14} /> Nova biblioteca
            </button>
          </div>
        )}
      </div>

      {menu && (
        <div ref={menuRef} className="context-menu" role="menu" style={{ left: menu.x, top: menu.y }}>
          {!menuEntry ? (
            <button type="button" role="menuitem" onClick={() => { setMenu(null); actions.newLibrary(); }}>
              <LibraryBig size={14} /> Nova biblioteca
            </button>
          ) : (
            <>
              <button type="button" role="menuitem" onClick={() => { setMenu(null); actions.newNote(menuFolder); }}>
                <FilePlus2 size={14} /> Nova nota
              </button>
              <button type="button" role="menuitem" onClick={() => { setMenu(null); actions.newDiagram(menuFolder); }}>
                <Workflow size={14} /> Novo diagrama
              </button>
              <button type="button" role="menuitem" onClick={() => { setMenu(null); actions.newFolder(menuFolder); }}>
                <FolderPlus size={14} /> Nova pasta
              </button>
              {menuEntry.type !== "library" && (
                <>
                  <hr />
                  <button type="button" role="menuitem" onClick={() => { setMenu(null); actions.rename(menuEntry); }}>
                    Renomear <span className="kbd">F2</span>
                  </button>
                  <button type="button" role="menuitem" className="danger" onClick={() => { setMenu(null); actions.remove(menuEntry); }}>
                    Excluir <span className="kbd">Del</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </nav>
  );
}
