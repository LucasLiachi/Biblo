export type DocumentKind = "markdown" | "diagram";
export type EntryKind = DocumentKind | "asset";

export interface LibraryEntry {
  path: string;
  name: string;
  /** "library": pasta mestra no primeiro nível; só ela pode existir na raiz. */
  type: "library" | "directory" | "file";
  kind?: EntryKind;
  size?: number;
}

export interface TreeNode extends LibraryEntry {
  children: TreeNode[];
}

export type SaveState = "saved" | "dirty" | "saving" | "conflict" | "error";

export interface OpenDocument {
  path: string;
  name: string;
  kind: DocumentKind;
  content: string;
  savedContent: string;
  etag: string;
  state: SaveState;
  error?: string;
  /** Incrementa quando o conteúdo é trocado por fora do editor (disco, conflito). */
  revision: number;
}

export interface Citation {
  chunk_id: number;
  path: string;
  title: string;
  kind: DocumentKind;
  heading: string;
  start_line: number;
  end_line: number;
  snippet: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  searchMode?: "hybrid" | "text";
  error?: string;
}

export interface IndexStatus {
  status: "starting" | "idle" | "indexing" | "error" | "offline";
  db_connected: boolean;
  watcher_mode?: string;
  total_documents?: number;
  total_chunks?: number;
  chunks_without_embedding?: number;
  pending?: number;
  last_reconciliation?: string | null;
  last_error?: string | null;
  embedding_model?: string;
  embeddings_error?: string | null;
}

export interface Conflict {
  path: string;
  mine: string;
  theirs: string;
  theirsEtag: string;
}

export interface LinksInfo {
  backlinks: Array<{ path: string; title: string; kind: DocumentKind }>;
  outgoing: Array<{ target: string; path: string | null }>;
}

export interface LLMSettings {
  base_url: string;
  has_api_key: boolean;
  default_model: string;
  guide_prompt: string;
  embedding_provider: EmbeddingProvider;
  embedding_model: string;
  embedding_dim: number;
}

/** "chat": mesmo servidor e token do chat; "ollama": Ollama local; "none": só busca textual. */
export type EmbeddingProvider = "chat" | "ollama" | "none";

export interface LLMSettingsInput {
  base_url: string;
  /** undefined mantém o token salvo; "" remove. */
  api_key?: string;
  default_model: string;
  guide_prompt: string;
  embedding_provider?: EmbeddingProvider;
  embedding_model?: string;
}
