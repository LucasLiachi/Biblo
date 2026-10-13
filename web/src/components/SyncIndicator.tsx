import type { IndexStatus, SaveState } from "../types";

interface SyncIndicatorProps {
  index: IndexStatus | null;
  saveState: SaveState | null;
}

/** Estado real do disco e do índice: nunca mostra "sincronizado" quando não está. */
export function describeSync(index: IndexStatus | null, saveState: SaveState | null): { tone: string; text: string; title: string } {
  if (saveState === "conflict") return { tone: "error", text: "Conflito com o disco", title: "O arquivo mudou fora do Biblo." };
  if (saveState === "error") return { tone: "error", text: "Falha ao gravar", title: "A última gravação em disco falhou." };
  if (saveState === "saving" || saveState === "dirty") return { tone: "syncing", text: "Salvando…", title: "Autosave a cada 1,5 s." };
  if (!index) return { tone: "offline", text: "Conectando…", title: "" };
  if (!index.db_connected || index.status === "offline") {
    return { tone: "offline", text: "Índice offline", title: index.last_error ?? "Banco indisponível: edição funciona, busca e chat não." };
  }
  if (index.status === "indexing" || index.status === "starting" || (index.pending ?? 0) > 0) {
    return { tone: "syncing", text: "Indexando…", title: `${index.pending ?? 0} alteração(ões) na fila` };
  }
  const docs = `${index.total_documents ?? 0} docs`;
  if (index.embeddings_error || (index.chunks_without_embedding ?? 0) > 0) {
    return {
      tone: "syncing",
      text: `Sincronizado · ${docs} · só texto`,
      title: `Busca semântica pendente: ${index.embeddings_error ?? `${index.chunks_without_embedding} trechos sem vetor`}`,
    };
  }
  return { tone: "", text: `Sincronizado · ${docs}`, title: `Watcher: ${index.watcher_mode} · ${index.embedding_model}` };
}

export function SyncIndicator({ index, saveState }: SyncIndicatorProps) {
  const { tone, text, title } = describeSync(index, saveState);
  return (
    <div className={`sync-indicator ${tone}`} role="status" aria-live="polite" title={title}>
      <span className="sync-dot" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
