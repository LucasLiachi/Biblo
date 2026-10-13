import type { ChatMessage, Citation, IndexStatus, LibraryEntry, LinksInfo, LLMSettings, LLMSettingsInput } from "../types";

export class ApiError extends Error {
  constructor(public status: number, message: string, public detail?: unknown) {
    super(message);
  }
}

export class ConflictError extends ApiError {
  constructor(public theirs: string, public theirsEtag: string) {
    super(409, "O arquivo foi modificado fora do Biblo.");
  }
}

const BASE = "/api";
let sessionPromise: Promise<void> | null = null;

/** Abre a sessão local: a API grava um cookie HttpOnly que o JavaScript nunca lê. */
function ensureSession(force = false): Promise<void> {
  if (!sessionPromise || force) {
    sessionPromise = fetch(`${BASE}/session`, { credentials: "same-origin" }).then((res) => {
      if (!res.ok) throw new ApiError(res.status, "Não foi possível abrir a sessão local.");
    });
    sessionPromise.catch(() => (sessionPromise = null));
  }
  return sessionPromise;
}

async function request(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  await ensureSession();
  const res = await fetch(`${BASE}${path}`, { credentials: "same-origin", ...init });
  if (res.status === 401 && retry) {
    await ensureSession(true);
    return request(path, init, false);
  }
  if (!res.ok) {
    let detail: unknown = res.statusText;
    try {
      detail = (await res.clone().json()).detail;
    } catch {
      /* corpo não-JSON */
    }
    // 422 do FastAPI: lista de erros de validação; mostra só as mensagens.
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => (d.msg ?? "").replace(/^Value error, /, "")).join("; ")
          : `Erro ${res.status}`;
    throw new ApiError(res.status, message, detail);
  }
  return res;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const q = (params: Record<string, string>) => new URLSearchParams(params).toString();

export const api = {
  async libraries(): Promise<string[]> {
    return (await (await request("/libraries")).json()).libraries;
  },

  async createLibrary(name: string): Promise<string> {
    return (await (await request("/libraries", json({ name }))).json()).name;
  },

  async tree(): Promise<LibraryEntry[]> {
    return (await (await request("/files/tree")).json()).tree;
  },

  async readFile(path: string): Promise<{ content: string; etag: string }> {
    const res = await request(`/files?${q({ path })}`);
    return { content: await res.text(), etag: (res.headers.get("ETag") ?? "").replace(/"/g, "") };
  },

  async createFile(path: string, content: string): Promise<{ path: string; etag: string }> {
    return (await request("/files", json({ path, content }))).json();
  },

  async saveFile(path: string, content: string, etag: string): Promise<string> {
    try {
      const res = await request(`/files?${q({ path })}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "If-Match": `"${etag}"` },
        body: JSON.stringify({ content }),
      });
      return (await res.json()).etag;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const d = err.detail as { current_content: string; current_etag: string };
        throw new ConflictError(d.current_content, d.current_etag);
      }
      throw err;
    }
  },

  async deleteFile(path: string): Promise<void> {
    await request(`/files?${q({ path })}`, { method: "DELETE" });
  },

  async move(source: string, destination: string): Promise<string> {
    return (await (await request("/files/move", json({ source, destination }))).json()).path;
  },

  async createFolder(path: string): Promise<void> {
    await request("/folders", json({ path }));
  },

  async deleteFolder(path: string, recursive: boolean): Promise<void> {
    await request(`/folders?${q({ path, recursive: String(recursive) })}`, { method: "DELETE" });
  },

  /** Envia uma imagem para `folder` (ex.: "acervo/assets") e devolve o caminho completo. */
  async uploadAsset(file: File, folder: string): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    return (await (await request(`/assets?${q({ folder })}`, { method: "POST", body: form })).json()).path;
  },

  assetUrl(path: string): string {
    return `${BASE}/assets?${q({ path })}`;
  },

  async search(query: string, limit = 10, library?: string): Promise<{ mode: string; results: Citation[] }> {
    const params: Record<string, string> = { q: query, limit: String(limit) };
    if (library) params.library = library;
    return (await request(`/search?${q(params)}`)).json();
  },

  async links(path: string): Promise<LinksInfo> {
    return (await request(`/links?${q({ path })}`)).json();
  },

  async resolveLink(target: string, library: string): Promise<string | null> {
    return (await (await request(`/links/resolve?${q({ target, library })}`)).json()).path;
  },

  async models(): Promise<string[]> {
    return (await (await request("/models")).json()).models;
  },

  async llmSettings(): Promise<LLMSettings> {
    return (await request("/settings/llm")).json();
  },

  async saveLLMSettings(input: LLMSettingsInput): Promise<LLMSettings> {
    return (await request("/settings/llm", { ...json(input), method: "PUT" })).json();
  },

  /** Testa endereço e token sem salvar; devolve os modelos de chat e de embedding disponíveis. */
  async testLLMSettings(input: LLMSettingsInput): Promise<{ models: string[]; embedding_models: string[] }> {
    return (await request("/settings/llm/test", json(input))).json();
  },

  /** Gera um vetor de teste com a configuração de embeddings informada; devolve a dimensão. */
  async testEmbeddings(input: LLMSettingsInput): Promise<number> {
    return (await (await request("/settings/embeddings/test", json(input))).json()).dimensions;
  },

  async indexStatus(): Promise<IndexStatus> {
    return (await request("/index/status")).json();
  },

  async rebuildIndex(): Promise<void> {
    await request("/index/rebuild", json({}));
  },

  /** Chat RAG via SSE: citations → token* → (error) → done. */
  async streamChat(
    model: string,
    messages: Pick<ChatMessage, "role" | "content">[],
    handlers: {
      onCitations: (citations: Citation[], mode: "hybrid" | "text") => void;
      onToken: (token: string) => void;
      onError: (message: string) => void;
    },
    signal: AbortSignal,
    library?: string,
  ): Promise<void> {
    const res = await request("/chat/stream", { ...json({ model, messages, library: library || null }), signal });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = /^event: (.+)$/m.exec(block)?.[1];
        const data = /^data: (.*)$/m.exec(block)?.[1];
        if (!event || data === undefined) continue;
        const payload = JSON.parse(data);
        if (event === "citations") handlers.onCitations(payload.citations, payload.mode);
        else if (event === "token") handlers.onToken(payload.t);
        else if (event === "error") handlers.onError(payload.message);
        else if (event === "done") return;
      }
    }
  },
};
