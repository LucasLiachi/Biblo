import { ChevronDown, ChevronRight, FilePlus2, FileText, Folder, FolderOpen, FolderPlus, Image, PenTool, Workflow } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type JSX, type MouseEvent } from "react";

import { buildTree, parentOf } from "../lib/vault";
import type { TreeNode, VaultEntry } from "../types";

export interface VaultActions {
  open: (path: string) => void;
  newNote: (folder: string) => void;
  newDiagram: (folder: string) => void;
  newFolder: (folder: string) => void;
  rename: (entry: VaultEntry) => void;
  move: (source: string, targetFolder: string) => void;
  remove: (entry: VaultEntry) => void;
}

interface VaultTreeProps {
  entries: VaultEntry[];
  activePath?: string;
  error?: string | null;
  actions: VaultActions;
}

interface MenuState {
  x: number;
  y: number;
  entry: VaultEntry | null; // null = raiz do vault
}

const EXPANDED_KEY = "biblo.vault.expanded";

function loadExpanded(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function FileIcon({ node }: { node: VaultEntry }) {
  if (node.kind === "diagram") return <PenTool size={14} className="tree-icon tree-icon-canvas" aria-hidden="true" />;
  if (node.kind === "asset") return <Image size={14} className="tree-icon" aria-hidden="true" />;
  return <FileText size={14} className="tree-icon tree-icon-md" aria-hidden="true" />;
}

export function VaultTree({ entries, activePath, error, actions }: VaultTreeProps) {
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

  // Revela o arquivo ativo abrindo as pastas ancestrais.
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
    !query || node.name.toLowerCase().includes(query) || node.children.some(matches);

  const openMenu = (e: MouseEvent, entry: VaultEntry | null) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: Math.min(e.clientX, window.innerWidth - 220), y: Math.min(e.clientY, window.innerHeight - 260), entry });
  };

  const onDragStart = (e: DragEvent, path: string) => {
    e.dataTransfer.setData("application/x-biblo-path", path);
    e.dataTransfer.effectAllowed = "move";
  };
  const dropProps = (folder: string) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes("application/x-biblo-path")) return;
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(folder);
    },
    onDragLeave: () => setDropTarget((t) => (t === folder ? null : t)),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(null);
      const source = e.dataTransfer.getData("application/x-biblo-path");
      if (source && source !== folder && parentOf(source) !== folder && !folder.startsWith(`${source}/`)) {
        actions.move(source, folder);
      }
    },
  });

  const renderNode = (node: TreeNode, depth: number): JSX.Element | null => {
    if (!matches(node)) return null;
    const isDir = node.type === "directory";
    const isOpen = isDir && (expanded.has(node.path) || !!query);
    const style = { "--depth": depth } as CSSProperties;
    return (
      <li key={node.path} role="treeitem" aria-expanded={isDir ? isOpen : undefined} aria-selected={node.path === activePath}>
        <div
          className={`tree-item tree-row ${node.path === activePath ? "active" : ""} ${dropTarget === node.path ? "drop-target" : ""}`}
          style={style}
          draggable
          tabIndex={0}
          onDragStart={(e) => onDragStart(e, node.path)}
          {...(isDir ? dropProps(node.path) : {})}
          onClick={() => (isDir ? toggle(node.path) : node.kind !== "asset" && actions.open(node.path))}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (isDir) toggle(node.path);
              else if (node.kind !== "asset") actions.open(node.path);
            } else if (e.key === "F2") actions.rename(node);
            else if (e.key === "Delete") actions.remove(node);
            else if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setMenu({ x: rect.left + 24, y: rect.bottom, entry: node });
            }
          }}
          onContextMenu={(e) => openMenu(e, node)}
          title={node.path}
        >
          <span className="tree-item-label">
            {isDir ? (
              <>
                {isOpen ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
                {isOpen ? (
                  <FolderOpen size={14} className="tree-icon tree-icon-folder" aria-hidden="true" />
                ) : (
                  <Folder size={14} className="tree-icon tree-icon-folder" aria-hidden="true" />
                )}
              </>
            ) : (
              <FileIcon node={node} />
            )}
            <span>{node.name}</span>
          </span>
          {isDir && (
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
        {isDir && isOpen && node.children.length > 0 && (
          <ul className="tree-list" role="group">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  const menuFolder = menu?.entry ? (menu.entry.type === "directory" ? menu.entry.path : parentOf(menu.entry.path)) : "";

  return (
    <nav className="vault-tree" aria-label="Arquivos do vault">
      <div className="tree-header">
        <span>Vault</span>
        <span className="header-actions">
          <button type="button" className="btn btn-ghost btn-icon" title="Nova nota" aria-label="Nova nota na raiz" onClick={() => actions.newNote("")}>
            <FilePlus2 size={14} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon" title="Novo diagrama" aria-label="Novo diagrama na raiz" onClick={() => actions.newDiagram("")}>
            <Workflow size={14} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon" title="Nova pasta" aria-label="Nova pasta na raiz" onClick={() => actions.newFolder("")}>
            <FolderPlus size={14} />
          </button>
        </span>
      </div>
      <input
        className="tree-filter"
        type="search"
        placeholder="Filtrar arquivos…"
        aria-label="Filtrar arquivos do vault"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {error && <div className="tree-error" role="alert">{error}</div>}
      <div
        className={`tree-scroll tree-root-drop ${dropTarget === "" ? "drop-target" : ""}`}
        onContextMenu={(e) => openMenu(e, null)}
        {...dropProps("")}
      >
        <ul className="tree-list" role="tree" aria-label="Vault">
          {tree.map((node) => renderNode(node, 0))}
        </ul>
        {tree.length === 0 && !error && <p className="chat-meta tree-empty">Vault vazio. Crie a primeira nota.</p>}
      </div>

      {menu && (
        <div ref={menuRef} className="context-menu" role="menu" style={{ left: menu.x, top: menu.y }}>
          <button type="button" role="menuitem" onClick={() => { setMenu(null); actions.newNote(menuFolder); }}>
            <FilePlus2 size={14} /> Nova nota
          </button>
          <button type="button" role="menuitem" onClick={() => { setMenu(null); actions.newDiagram(menuFolder); }}>
            <Workflow size={14} /> Novo diagrama
          </button>
          <button type="button" role="menuitem" onClick={() => { setMenu(null); actions.newFolder(menuFolder); }}>
            <FolderPlus size={14} /> Nova pasta
          </button>
          {menu.entry && (
            <>
              <hr />
              <button type="button" role="menuitem" onClick={() => { const e = menu.entry!; setMenu(null); actions.rename(e); }}>
                Renomear <span className="kbd">F2</span>
              </button>
              <button type="button" role="menuitem" className="danger" onClick={() => { const e = menu.entry!; setMenu(null); actions.remove(e); }}>
                Excluir <span className="kbd">Del</span>
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
