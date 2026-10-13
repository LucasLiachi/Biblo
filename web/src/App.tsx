import { FilePlus2, LibraryBig, Workflow } from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiError, ConflictError, api } from "./api/client";
import { AppHeader } from "./components/AppHeader";
import { BrandMark } from "./components/BrandMark";
import { ChatPanel } from "./components/ChatPanel";
import { CommandPalette } from "./components/CommandPalette";
import { ConflictModal } from "./components/ConflictModal";
import { ConfirmDialog, PromptDialog, type ConfirmRequest, type PromptRequest } from "./components/Dialog";
import { DocumentTabs } from "./components/DocumentTabs";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { MarkdownEditor } from "./components/MarkdownEditor";
import { LibraryTree, type LibraryActions } from "./components/LibraryTree";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import {
  baseName,
  insideLibrary,
  joinPath,
  kindOf,
  libraryOf,
  parentOf,
  remapPath,
  stripExtension,
  validateName,
  withExtension,
} from "./lib/paths";
import type { Conflict, DocumentKind, IndexStatus, OpenDocument, LibraryEntry } from "./types";

// Excalidraw é grande: só carrega quando um diagrama é aberto.
const DiagramCanvas = lazy(() => import("./components/DiagramCanvas"));

const AUTOSAVE_MS = 1500;
const POLL_MS = 4000;
const THEME_KEY = "biblo.theme";
const EMPTY_DIAGRAM = JSON.stringify({ type: "excalidraw", version: 2, source: "biblo", elements: [], appState: {}, files: {} }, null, 2);

const readTheme = (): "dark" | "light" => {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
};

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Erro inesperado.");

export function App() {
  const [theme, setTheme] = useState(readTheme);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [docs, setDocs] = useState<OpenDocument[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [index, setIndex] = useState<IndexStatus | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [prompt, setPrompt] = useState<PromptRequest | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [jump, setJump] = useState<{ line: number; nonce: number } | null>(null);

  // Estado mais recente para timers e callbacks assíncronos (evita gravar no arquivo errado).
  const docsRef = useRef(docs);
  docsRef.current = docs;
  const timers = useRef(new Map<string, number>());
  const saving = useRef(new Map<string, Promise<void>>());

  const patchDoc = useCallback((path: string, fn: (d: OpenDocument) => OpenDocument) => {
    setDocs((prev) => prev.map((d) => (d.path === path ? fn(d) : d)));
  }, []);

  // ---------- Bibliotecas e índice ----------
  // O polling roda a cada 4 s: só troca o estado quando o conteúdo mudou, para não redesenhar o app à toa.
  const refreshTree = useCallback(async () => {
    try {
      const tree = await api.tree();
      setEntries((prev) => (sameJson(prev, tree) ? prev : tree));
      setTreeError(null);
    } catch (err) {
      setTreeError(`Não foi possível ler as bibliotecas: ${errorMessage(err)}`);
    }
  }, []);

  const refreshIndex = useCallback(async () => {
    try {
      const status = await api.indexStatus();
      setIndex((prev) => (sameJson(prev, status) ? prev : status));
    } catch {
      const offline: IndexStatus = { status: "offline", db_connected: false, last_error: "API indisponível." };
      setIndex((prev) => (sameJson(prev, offline) ? prev : offline));
    }
  }, []);

  // ---------- Gravação ----------
  const saveNow = useCallback(
    async (path: string): Promise<void> => {
      window.clearTimeout(timers.current.get(path));
      timers.current.delete(path);
      const running = saving.current.get(path);
      if (running) {
        await running;
        const after = docsRef.current.find((d) => d.path === path);
        if (after && after.content !== after.savedContent && after.state !== "conflict") return saveNow(path);
        return;
      }
      const doc = docsRef.current.find((d) => d.path === path);
      if (!doc || doc.state === "conflict" || doc.content === doc.savedContent) return;

      const content = doc.content;
      const job = (async () => {
        patchDoc(path, (d) => ({ ...d, state: "saving" }));
        try {
          const etag = await api.saveFile(path, content, doc.etag);
          patchDoc(path, (d) => ({ ...d, etag, savedContent: content, state: d.content === content ? "saved" : "dirty", error: undefined }));
        } catch (err) {
          if (err instanceof ConflictError) {
            patchDoc(path, (d) => ({ ...d, state: "conflict" }));
            setConflict({ path, mine: content, theirs: err.theirs, theirsEtag: err.theirsEtag });
          } else {
            patchDoc(path, (d) => ({ ...d, state: "error", error: errorMessage(err) }));
          }
        }
      })();
      saving.current.set(path, job);
      await job;
      saving.current.delete(path);
      const after = docsRef.current.find((d) => d.path === path);
      if (after && after.state === "dirty") scheduleSave(path);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patchDoc],
  );

  const scheduleSave = useCallback(
    (path: string, delay = AUTOSAVE_MS) => {
      window.clearTimeout(timers.current.get(path));
      timers.current.set(path, window.setTimeout(() => void saveNow(path), delay));
    },
    [saveNow],
  );

  const handleChange = useCallback(
    (path: string, content: string) => {
      setDocs((prev) =>
        prev.map((d) =>
          d.path === path ? { ...d, content, state: d.state === "conflict" ? "conflict" : content === d.savedContent ? "saved" : "dirty" } : d,
        ),
      );
      const doc = docsRef.current.find((d) => d.path === path);
      if (doc?.state !== "conflict") scheduleSave(path);
    },
    [scheduleSave],
  );

  const flushAll = useCallback(async (paths?: string[]) => {
    const targets = paths ?? docsRef.current.map((d) => d.path);
    await Promise.all(targets.map((p) => saveNow(p)));
  }, [saveNow]);

  // ---------- Abertura ----------
  const openPath = useCallback(
    async (path: string, line?: number) => {
      const kind = kindOf(path);
      if (!kind) return;
      if (!docsRef.current.some((d) => d.path === path)) {
        try {
          const { content, etag } = await api.readFile(path);
          const doc: OpenDocument = { path, name: baseName(path), kind, content, savedContent: content, etag, state: "saved", revision: 0 };
          setDocs((prev) => (prev.some((d) => d.path === path) ? prev : [...prev, doc]));
        } catch (err) {
          setTreeError(`Não foi possível abrir ${path}: ${errorMessage(err)}`);
          return;
        }
      }
      setActivePath(path);
      if (line && kind === "markdown") setJump({ line, nonce: Date.now() });
    },
    [],
  );

  const libraries = useMemo(() => entries.filter((e) => e.type === "library").map((e) => e.path), [entries]);
  // Biblioteca de trabalho: a do documento ativo, ou a primeira existente.
  const currentLibrary = activePath ? libraryOf(activePath) : (libraries[0] ?? null);

  const newLibrary = useCallback(() => {
    setPrompt({
      title: "Nova biblioteca",
      label: "Nome da biblioteca",
      initial: "nova-biblioteca",
      confirmLabel: "Criar",
      validate: validateName,
      onSubmit: async (name) => {
        await api.createLibrary(name);
        await refreshTree();
      },
    });
  }, [refreshTree]);

  /** Cria nota ou diagrama em `folder` (dentro de uma biblioteca). Sem pasta, usa a biblioteca de trabalho. */
  const createDocument = useCallback(
    (folder: string, kind: DocumentKind, suggested?: string) => {
      const target = folder || currentLibrary;
      if (!target) return newLibrary();
      setPrompt({
        title: kind === "diagram" ? "Novo diagrama" : "Nova nota",
        label: "Nome do arquivo",
        initial: suggested ?? (kind === "diagram" ? "novo-diagrama" : "nova-nota"),
        confirmLabel: "Criar",
        validate: validateName,
        onSubmit: async (name) => {
          const fileName = withExtension(name, kind);
          const path = joinPath(target, fileName);
          const content = kind === "diagram" ? EMPTY_DIAGRAM : `# ${stripExtension(fileName)}\n\n`;
          await api.createFile(path, content);
          await refreshTree();
          await openPath(path);
        },
      });
    },
    [currentLibrary, newLibrary, openPath, refreshTree],
  );

  /** [[alvo]]: resolve dentro da biblioteca do documento ativo; sem índice, procura pelo nome; se não existir, oferece criar. */
  const openLink = useCallback(
    async (target: string) => {
      const clean = stripExtension(target.trim());
      const library = activePath ? libraryOf(activePath) : currentLibrary;
      if (!library) return;
      let path: string | null = null;
      try {
        path = await api.resolveLink(clean, library);
      } catch {
        const lower = clean.toLowerCase();
        const docs = entries.filter((e) => e.type === "file" && e.kind !== "asset" && libraryOf(e.path) === library);
        path =
          docs.find((e) => stripExtension(insideLibrary(e.path)).toLowerCase() === lower)?.path ??
          docs.find((e) => stripExtension(e.name).toLowerCase() === lower.split("/").pop())?.path ??
          null;
      }
      if (path) return openPath(path);
      const folder = clean.includes("/") ? joinPath(library, parentOf(clean)) : activePath ? parentOf(activePath) : library;
      createDocument(folder, "markdown", baseName(clean));
    },
    [activePath, createDocument, currentLibrary, entries, openPath],
  );

  const closeDoc = useCallback(
    async (path: string) => {
      const doc = docsRef.current.find((d) => d.path === path);
      if (!doc) return;
      if (doc.state === "conflict") return; // o modal de conflito exige uma escolha antes
      await saveNow(path);
      const after = docsRef.current.find((d) => d.path === path);
      if (after && (after.state === "error" || after.state === "conflict")) return; // não perde o texto
      setDocs((prev) => {
        const remaining = prev.filter((d) => d.path !== path);
        setActivePath((current) => (current === path ? (remaining[remaining.length - 1]?.path ?? null) : current));
        return remaining;
      });
    },
    [saveNow],
  );

  // ---------- Gestão de pastas ----------
  const relocate = useCallback(
    async (source: string, destination: string) => {
      const affected = docsRef.current.filter((d) => remapPath(d.path, source, destination) !== d.path).map((d) => d.path);
      await flushAll(affected);
      const finalPath = await api.move(source, destination);
      setDocs((prev) => prev.map((d) => ({ ...d, path: remapPath(d.path, source, finalPath), name: baseName(remapPath(d.path, source, finalPath)) })));
      setActivePath((p) => (p ? remapPath(p, source, finalPath) : p));
      await refreshTree();
    },
    [flushAll, refreshTree],
  );

  const libraryActions: LibraryActions = {
    open: (path) => void openPath(path),
    newLibrary,
    newNote: (folder) => createDocument(folder, "markdown"),
    newDiagram: (folder) => createDocument(folder, "diagram"),
    newFolder: (folder) =>
      setPrompt({
        title: "Nova pasta",
        label: "Nome da pasta",
        initial: "nova-pasta",
        confirmLabel: "Criar",
        validate: validateName,
        onSubmit: async (name) => {
          await api.createFolder(joinPath(folder, name));
          await refreshTree();
        },
      }),
    rename: (entry) =>
      setPrompt({
        title: entry.type === "directory" ? "Renomear pasta" : "Renomear arquivo",
        label: "Novo nome",
        initial: entry.name,
        confirmLabel: "Renomear",
        validate: validateName,
        onSubmit: async (name) => {
          const kind = entry.type === "file" ? kindOf(entry.path) : null;
          const newName = kind ? withExtension(name, kind) : name;
          if (newName !== entry.name) await relocate(entry.path, joinPath(parentOf(entry.path), newName));
        },
      }),
    move: (source, folder) => {
      relocate(source, joinPath(folder, baseName(source))).catch((err) => setTreeError(errorMessage(err)));
    },
    remove: (entry) =>
      setConfirm({
        title: entry.type === "directory" ? "Excluir pasta" : "Excluir arquivo",
        message:
          entry.type === "directory"
            ? `Excluir "${entry.path}" e tudo o que está dentro dela? Tudo vai para a pasta .lixeira da biblioteca e pode ser recuperado pelo disco.`
            : `Excluir "${entry.path}"? O arquivo vai para a pasta .lixeira da biblioteca e pode ser recuperado pelo disco.`,
        confirmLabel: "Excluir",
        danger: true,
        onConfirm: async () => {
          if (entry.type === "directory") await api.deleteFolder(entry.path, true);
          else await api.deleteFile(entry.path);
          const gone = (p: string) => p === entry.path || p.startsWith(`${entry.path}/`);
          docsRef.current.filter((d) => gone(d.path)).forEach((d) => window.clearTimeout(timers.current.get(d.path)));
          setDocs((prev) => prev.filter((d) => !gone(d.path)));
          setActivePath((p) => (p && gone(p) ? null : p));
          await refreshTree();
        },
      }),
  };

  // ---------- Conflitos ----------
  const resolveConflict = async (choice: "mine" | "disk" | "copy") => {
    if (!conflict) return;
    const { path, mine, theirs, theirsEtag } = conflict;
    setConflict(null);
    try {
      if (choice === "mine") {
        const etag = await api.saveFile(path, mine, theirsEtag);
        patchDoc(path, (d) => ({ ...d, etag, savedContent: mine, state: d.content === mine ? "saved" : "dirty" }));
        return;
      }
      if (choice === "copy") {
        const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
        const ext = path.slice(path.lastIndexOf("."));
        const copy = `${stripExtension(path)}-conflito-${stamp}${ext}`;
        await api.createFile(copy, mine);
        await refreshTree();
      }
      patchDoc(path, (d) => ({ ...d, content: theirs, savedContent: theirs, etag: theirsEtag, state: "saved", revision: d.revision + 1 }));
    } catch (err) {
      patchDoc(path, (d) => ({ ...d, state: "error", error: errorMessage(err) }));
    }
  };

  // ---------- Efeitos ----------
  useEffect(() => {
    void refreshTree();
    void refreshIndex();
  }, [refreshTree, refreshIndex]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* sem armazenamento */
    }
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  // Disco é a fonte da verdade: acompanha mudanças externas na árvore, no índice e no documento ativo.
  useEffect(() => {
    const tick = async () => {
      if (document.hidden) return;
      void refreshTree();
      void refreshIndex();
      const doc = docsRef.current.find((d) => d.path === activePath);
      if (!doc || doc.state !== "saved" || saving.current.has(doc.path)) return;
      try {
        const disk = await api.readFile(doc.path);
        const current = docsRef.current.find((d) => d.path === doc.path);
        if (disk.etag !== doc.etag && current?.state === "saved") {
          patchDoc(doc.path, (d) => ({ ...d, content: disk.content, savedContent: disk.content, etag: disk.etag, revision: d.revision + 1 }));
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          patchDoc(doc.path, (d) => ({ ...d, state: "error", error: "Arquivo removido do disco. Salve uma cópia para não perder o conteúdo." }));
        }
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, [activePath, patchDoc, refreshIndex, refreshTree]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (docsRef.current.some((d) => d.content !== d.savedContent)) {
        void flushAll();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [flushAll]);

  useKeyboardShortcuts({
    onCloseTab: () => activePath && void closeDoc(activePath),
    onToggleLibraries: () => setLibraryOpen((v) => !v),
    onToggleChat: () => setChatOpen((v) => !v),
    onFocusMode: () => {
      // Modo foco: some com as laterais; repetir o atalho traz as duas de volta.
      const anyOpen = libraryOpen || chatOpen;
      setLibraryOpen(!anyOpen);
      setChatOpen(!anyOpen);
    },
    onCommandPalette: () => setPaletteOpen((v) => !v),
    onSave: () => activePath && void saveNow(activePath),
  });

  const activeDoc = docs.find((d) => d.path === activePath) ?? null;
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <div className="studio">
      <AppHeader
        index={index}
        saveState={activeDoc?.state ?? null}
        isLibraryPanelOpen={libraryOpen}
        isChatOpen={chatOpen}
        theme={theme}
        onToggleLibraries={() => setLibraryOpen((v) => !v)}
        onToggleChat={() => setChatOpen((v) => !v)}
        onToggleTheme={toggleTheme}
        onOpenCommandPalette={() => setPaletteOpen(true)}
        onRebuildIndex={() => api.rebuildIndex().then(refreshIndex).catch((err) => setTreeError(errorMessage(err)))}
      />

      <div className="studio-body">
        {libraryOpen && (
          <div className="panel-library">
            <ErrorBoundary area="Bibliotecas">
              <LibraryTree entries={entries} activePath={activePath ?? undefined} error={treeError} actions={libraryActions} />
            </ErrorBoundary>
          </div>
        )}

        <main className="workspace">
          <DocumentTabs documents={docs} activePath={activePath} onSelect={setActivePath} onClose={(p) => void closeDoc(p)} />
          <div className="workspace-body">
            <ErrorBoundary area="Área de trabalho" key={activePath ?? "vazio"}>
            {!activeDoc ? (
              <div className="workspace-empty">
                <BrandMark variant="solid" title="" />
                <h2>Biblo</h2>
                {currentLibrary ? (
                  <>
                    <p>
                      Notas em Markdown, diagramas no Excalidraw e o chat Pergunte para o Biblo, que responde com base nos materiais de cada
                      biblioteca. Biblioteca atual: <strong>{currentLibrary}</strong>.
                    </p>
                    <div className="actions">
                      <button type="button" className="btn btn-primary" onClick={() => createDocument("", "markdown")}>
                        <FilePlus2 size={14} /> Nova nota
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => createDocument("", "diagram")}>
                        <Workflow size={14} /> Novo diagrama
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={newLibrary}>
                        <LibraryBig size={14} /> Nova biblioteca
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => setPaletteOpen(true)}>
                        Buscar <span className="kbd">Ctrl K</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>
                      Cada biblioteca é uma pasta mestra com materiais dedicados: notas, diagramas e imagens. O Biblo
                      responde com base no que está nela. Crie a primeira para começar.
                    </p>
                    <div className="actions">
                      <button type="button" className="btn btn-primary" onClick={newLibrary}>
                        <LibraryBig size={14} /> Nova biblioteca
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : activeDoc.kind === "diagram" ? (
              <Suspense fallback={<div className="canvas-loading">Carregando o canvas…</div>}>
                <DiagramCanvas key={activeDoc.path} doc={activeDoc} theme={theme} onChange={handleChange} />
              </Suspense>
            ) : (
              <MarkdownEditor
                key={activeDoc.path}
                doc={activeDoc}
                entries={entries}
                theme={theme}
                jumpTo={jump}
                onChange={handleChange}
                onOpenLink={(t) => void openLink(t)}
                onOpenPath={(p) => void openPath(p)}
              />
            )}
            </ErrorBoundary>
          </div>
        </main>

        {chatOpen && (
          <div className="panel-chat">
            <ErrorBoundary area="Pergunte para o Biblo">
              <ChatPanel
                libraries={libraries}
                currentLibrary={currentLibrary}
                onOpenPath={(p, line) => void openPath(p, line)}
                onClose={() => setChatOpen(false)}
              />
            </ErrorBoundary>
          </div>
        )}
      </div>

      {paletteOpen && (
        <CommandPalette
          entries={entries}
          onClose={() => setPaletteOpen(false)}
          onOpenPath={(p, line) => void openPath(p, line)}
          onNewNote={() => createDocument("", "markdown")}
          onNewDiagram={() => createDocument("", "diagram")}
          onNewLibrary={newLibrary}
          onToggleTheme={toggleTheme}
        />
      )}
      {conflict && (
        <ConflictModal
          conflict={conflict}
          onKeepMine={() => void resolveConflict("mine")}
          onUseDisk={() => void resolveConflict("disk")}
          onSaveCopy={() => void resolveConflict("copy")}
          onClose={() => undefined /* escolha obrigatória: nenhuma versão é descartada em silêncio */}
        />
      )}
      {prompt && <PromptDialog request={prompt} onClose={() => setPrompt(null)} />}
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}
