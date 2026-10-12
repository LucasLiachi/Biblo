import { Eraser, Send, Square, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";

import { ApiError, api } from "../api/client";
import { renderChatMarkdown } from "../lib/markdown";
import type { ChatMessage } from "../types";
import { BrandMark } from "./BrandMark";
import { CitationBadge } from "./CitationBadge";

interface ChatPanelProps {
  onOpenPath: (path: string, line?: number) => void;
  onClose: () => void;
}

const MODEL_KEY = "biblo.chat.model";
const newId = () => crypto.randomUUID();

/** O copiloto cita no formato [notas/x.md]; vira link clicável para o arquivo. */
const linkCitations = (text: string) => text.replace(/\[([^[\]\n]+?\.(?:md|markdown|excalidraw))\](?!\()/g, "[[$1]]");

export function ChatPanel({ onOpenPath, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [modelsError, setModelsError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const loadModels = useCallback(() => {
    setModelsError(null);
    api
      .models()
      .then((list) => {
        setModels(list);
        let saved = "";
        try {
          saved = localStorage.getItem(MODEL_KEY) ?? "";
        } catch {
          /* sem armazenamento */
        }
        setModel(list.includes(saved) ? saved : (list[0] ?? ""));
        if (!list.length) setModelsError("O gateway não expõe nenhum modelo.");
      })
      .catch((err) => setModelsError(err instanceof ApiError ? err.message : "Gateway de LLM indisponível."));
  }, []);

  useEffect(loadModels, [loadModels]);
  useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [messages]);
  useEffect(() => () => abort.current?.abort(), []);

  const update = (id: string, fn: (m: ChatMessage) => ChatMessage) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));

  const send = async () => {
    const text = input.trim();
    if (!text || streaming || !model) return;
    const user: ChatMessage = { id: newId(), role: "user", content: text };
    const assistant: ChatMessage = { id: newId(), role: "assistant", content: "" };
    const history = [...messages.filter((m) => !m.error), user].slice(-20).map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, user, assistant]);
    setInput("");
    setStreaming(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      await api.streamChat(
        model,
        history,
        {
          onCitations: (citations, searchMode) => update(assistant.id, (m) => ({ ...m, citations, searchMode })),
          onToken: (t) => update(assistant.id, (m) => ({ ...m, content: m.content + t })),
          onError: (message) => update(assistant.id, (m) => ({ ...m, error: message })),
        },
        controller.signal,
      );
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        update(assistant.id, (m) => ({ ...m, error: err instanceof Error ? err.message : "Falha na conexão." }));
      }
    } finally {
      setStreaming(false);
      abort.current = null;
    }
  };

  const onBubbleClick = (e: MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest("a");
    // Citações inline no formato [caminho/arquivo.md] chegam como texto; links do vault abrem no editor.
    if (anchor?.dataset.wikilink) {
      e.preventDefault();
      onOpenPath(anchor.dataset.wikilink);
    }
  };

  return (
    <section className="chat-panel" aria-label="Copiloto do vault">
      <header className="chat-header">
        <span className="chat-header-title">Copiloto</span>
        <span className="header-actions">
          {models.length > 0 && (
            <select
              className="chat-model-select"
              aria-label="Modelo"
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                try {
                  localStorage.setItem(MODEL_KEY, e.target.value);
                } catch {
                  /* sem armazenamento */
                }
              }}
            >
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
          <button type="button" className="btn btn-ghost btn-icon" title="Limpar conversa" aria-label="Limpar conversa" onClick={() => setMessages([])} disabled={streaming}>
            <Eraser size={15} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon" title="Fechar (Ctrl+Shift+L)" aria-label="Fechar copiloto" onClick={onClose}>
            <X size={15} />
          </button>
        </span>
      </header>

      <div className="chat-messages" aria-live="polite">
        {modelsError && (
          <div className="chat-notice error" role="alert">
            {modelsError} Configure LLM_BASE_URL no .env.{" "}
            <button type="button" className="btn btn-ghost" onClick={loadModels}>Tentar de novo</button>
          </div>
        )}
        {messages.length === 0 && (
          <div className="chat-empty">
            <BrandMark variant="solid" title="" />
            <p>Pergunte sobre suas notas e diagramas. As respostas citam os arquivos do vault.</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-bubble ${m.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"}`}>
            {m.role === "user" ? (
              m.content
            ) : (
              <>
                {m.content && (
                  // HTML de renderChatMarkdown: sem HTML bruto, sem imagens, sanitizado.
                  <div onClick={onBubbleClick} dangerouslySetInnerHTML={{ __html: renderChatMarkdown(linkCitations(m.content)) }} />
                )}
                {streaming && m === messages[messages.length - 1] && !m.error && <span className="ai-streaming-cursor" aria-hidden="true" />}
                {m.error && <div className="chat-notice error" role="alert">{m.error}</div>}
                {m.citations && m.citations.length > 0 && (
                  <div className="chat-citations" aria-label="Fontes">
                    {m.citations.map((c) => (
                      <CitationBadge key={c.chunk_id} citation={c} onOpen={onOpenPath} />
                    ))}
                  </div>
                )}
                {m.citations && m.citations.length === 0 && !streaming && (
                  <div className="chat-meta">Nenhum trecho do vault foi encontrado para esta pergunta.</div>
                )}
                {m.searchMode === "text" && <div className="chat-meta">Busca só textual: embeddings indisponíveis.</div>}
              </>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="chat-input-box">
        <textarea
          className="chat-textarea"
          placeholder={model ? "Pergunte ao seu vault…" : "Configure um modelo para conversar"}
          aria-label="Mensagem para o copiloto"
          value={input}
          disabled={!model}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <div className="chat-input-actions">
          <span className="chat-meta">Enter envia · Shift+Enter quebra linha</span>
          {streaming ? (
            <button type="button" className="btn btn-danger" onClick={() => abort.current?.abort()}>
              <Square size={13} /> Parar
            </button>
          ) : (
            <button type="button" className="btn btn-ai" onClick={() => void send()} disabled={!input.trim() || !model}>
              <Send size={13} /> Enviar
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
