import type { DocumentKind, TreeNode, VaultEntry } from "../types";

export function kindOf(path: string): DocumentKind | null {
  const lower = path.toLowerCase();
  if (lower.endsWith(".excalidraw")) return "diagram";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  return null;
}

export const baseName = (path: string) => path.split("/").pop() ?? path;
export const parentOf = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
export const joinPath = (folder: string, name: string) => (folder ? `${folder}/${name}` : name);
export const stripExtension = (name: string) => name.replace(/\.(md|markdown|excalidraw)$/i, "");

/** Lista plana da API -> árvore com pastas antes de arquivos, em ordem alfabética. */
export function buildTree(entries: VaultEntry[]): TreeNode[] {
  const root: TreeNode[] = [];
  const folders = new Map<string, TreeNode>();
  const sorted = [...entries].sort((a, b) => a.path.split("/").length - b.path.split("/").length);
  for (const entry of sorted) {
    const node: TreeNode = { ...entry, children: [] };
    if (entry.type === "directory") folders.set(entry.path, node);
    const parent = folders.get(parentOf(entry.path));
    (parent ? parent.children : root).push(node);
  }
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }) : a.type === "directory" ? -1 : 1,
    );
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(root);
  return root;
}

/** Nome válido para arquivo ou pasta do vault (sem barras, sem nomes ocultos). */
export function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Informe um nome.";
  if (/[\\/:*?"<>|]/.test(trimmed)) return "Use um nome sem / \\ : * ? \" < > |";
  if (trimmed.startsWith(".")) return "Nomes começando com ponto ficam ocultos no vault.";
  return null;
}

export function withExtension(name: string, kind: DocumentKind): string {
  const ext = kind === "diagram" ? ".excalidraw" : ".md";
  return name.trim().toLowerCase().endsWith(ext) ? name.trim() : `${stripExtension(name.trim())}${ext}`;
}

/** Reescreve caminhos abertos depois de mover/renomear `from` para `to` (arquivo ou pasta). */
export function remapPath(path: string, from: string, to: string): string {
  if (path === from) return to;
  return path.startsWith(`${from}/`) ? `${to}${path.slice(from.length)}` : path;
}
