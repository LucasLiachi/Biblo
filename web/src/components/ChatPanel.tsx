import { Eraser, Send, Settings, Square, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";

import { ApiError, api } from "../api/client";
import { renderChatMarkdown } from "../lib/markdown";
import type { ChatMessage } from "../types";
import { BrandMark } from "./BrandMark";
import { CitationBadge } from "./CitationBadge";
import { LLMSettingsDialog } from "./LLMSettingsDialog";

interface ChatPanelProps {
  libraries: string[];
  /** Biblioteca de trabalho; vira o escopo padrão do chat. */
  currentLibrary: string | null;
  onOpenPath: (path: string, line?: number) => void;
  onClose: () => void;
}

const newId = () => crypto.randomUUID();

/** O Biblo cita no formato [notas/x.md]; vira link clicável para o arquivo. */
const linkCitations = (text: string) => text.replace(/\[([^[\]\n]+?\.(?:md|markdown|excalidraw))\](?!\()/g, "[[$1]]");

const ALL = "";

export function ChatPanel({ libraries, currentLibrary, onOpenPath, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [scope, setScope] = useState<string>(currentLibrary ?? ALL);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [modelsError, setModelsError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);

  /** Modelos do servidor configurado; o modelo padrão da configuração vem selecionado. */
  const loadModels = useCallback(() => {
    setModelsError(null);
    Promise.all([api.models(), api.llmSettings().catch(() => null)])
      .then(([list, config]) => {
        // A lista já vem filtrada (só modelos de chat); um padrão fora dela não é usado.
        const preferred = config?.default_model ?? "";
        setModels(list);
        setModel(list.includes(preferred) ? preferred : (list[0] ?? ""));
        if (!list.length) setModelsError("O servidor configurado não expõe nenhum modelo de chat.");
      })
      .catch((err) => {
        setModels([]);
        setModel("");
        setModelsError(err instanceof ApiError ? err.message : "Servidor de LLM indisponível.");
      });
  }, []);

  // Efeitos sempre com corpo em chaves: no Chrome atual scrollIntoView() devolve uma Promise, e um efeito que
  // devolve algo além de função derruba o React na limpeza.
  useEffect(() => {
    loadModels();
  }, [loadModels]);
  // Ao trocar de biblioteca de trabalho, o chat acompanha.
  useEffect(() => {
    setScope(currentLibrary ?? ALL);
  }, [currentLibrary]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);
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
        scope || undefined,
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
    // Citações inline no formato [caminho/arquivo.md] chegam como texto; viram links que abrem no editor.
    if (anchor?.dataset.wikilink) {
      e.preventDefault();
      onOpenPath(anchor.dataset.wikilink);
    }
  };

  return (
    <section className="chat-panel" aria-label="Pergunte para o Biblo">
      <header className="chat-header">
        <span className="chat-header-title">Pergunte para o Biblo</span>
        <span className="header-actions">
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            title="Configurar o Biblo (modelo, token e prompt guia)"
            aria-label="Configurar o Biblo"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={15} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon" title="Limpar conversa" aria-label="Limpar conversa" onClick={() => setMessages([])} disabled={streaming}>
            <Eraser size={15} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon" title="Fechar (Ctrl+Shift+L)" aria-label="Fechar Pergunte para o Biblo" onClick={onClose}>
            <X size={15} />
          </button>
        </span>
      </header>
      <div className="chat-scope">
        <label>
          <span>Biblioteca</span>
          <select className="chat-model-select" value={scope} onChange={(e) => setScope(e.target.value)} disabled={streaming}>
            {libraries.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
            <option value={ALL}>Todas as bibliotecas</option>
          </select>
        </label>
        {models.length > 0 && (
          <label>
            <span>Modelo</span>
            <select className="chat-model-select" value={model} onChange={(e) => setModel(e.target.value)} disabled={streaming}>
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="chat-messages" aria-live="polite">
        {modelsError && (
          <div className="chat-notice error" role="alert">
            <p>{modelsError}</p>
            <div className="chat-notice-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setSettingsOpen(true)}>
                <Settings size={13} /> Configurar
              </button>
              <button type="button" className="btn btn-ghost" onClick={loadModels}>Tentar de novo</button>
            </div>
          </div>
        )}
        {messages.length === 0 && (
          <div className="chat-empty">
            <BrandMark variant="solid" title="" />
            <p>Pergunte sobre as notas e diagramas da biblioteca. As respostas citam os arquivos usados.</p>
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
                  <div className="chat-meta">Nenhum trecho da biblioteca foi encontrado para esta pergunta.</div>
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
          placeholder={model ? (scope ? `Pergunte à biblioteca ${scope}…` : "Pergunte a todas as bibliotecas…") : "Configure um modelo para conversar"}
          aria-label="Mensagem para o Biblo"
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
      {settingsOpen && (
        <LLMSettingsDialog
          onClose={() => setSettingsOpen(false)}
          onSaved={() => loadModels()}
        />
      )}
    </section>
  );
}
