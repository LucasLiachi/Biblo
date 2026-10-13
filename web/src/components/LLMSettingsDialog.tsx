import { CheckCircle2, PlugZap } from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "../api/client";
import type { EmbeddingProvider, LLMSettings, LLMSettingsInput } from "../types";
import { DialogFrame } from "./Dialog";

const GUIDE_LIMIT = 4000;
const GUIDE_EXAMPLE =
  "Ex.: Responda como um bibliotecário cordial e objetivo. Comece com um resumo de uma frase, depois detalhe em tópicos curtos e termine sugerindo uma nota relacionada.";

interface LLMSettingsDialogProps {
  onClose: () => void;
  onSaved: (settings: LLMSettings) => void;
}

/** Configuração da LLM usada por "Pergunte para o Biblo": endereço, token, modelo padrão e prompt guia. */
export function LLMSettingsDialog({ onClose, onSaved }: LLMSettingsDialogProps) {
  const [loaded, setLoaded] = useState<LLMSettings | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [clearToken, setClearToken] = useState(false);
  const [model, setModel] = useState("");
  const [guide, setGuide] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [embProvider, setEmbProvider] = useState<EmbeddingProvider>("none");
  const [embModel, setEmbModel] = useState("");
  const [embModels, setEmbModels] = useState<string[]>([]);
  const [embResult, setEmbResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .llmSettings()
      .then((s) => {
        setLoaded(s);
        setBaseUrl(s.base_url);
        setModel(s.default_model);
        setGuide(s.guide_prompt);
        setEmbProvider(s.embedding_provider);
        setEmbModel(s.embedding_model);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Não foi possível ler a configuração."));
  }, []);

  const input = (): LLMSettingsInput => ({
    base_url: baseUrl.trim(),
    api_key: clearToken ? "" : token.trim() ? token.trim() : undefined,
    default_model: model.trim(),
    guide_prompt: guide,
    embedding_provider: embProvider,
    embedding_model: embModel.trim(),
  });

  const test = async () => {
    setBusy(true);
    setTestResult(null);
    try {
      const found = await api.testLLMSettings(input());
      setModels(found.models);
      setEmbModels(found.embedding_models);
      if (!found.models.includes(model) && found.models.length) setModel(found.models[0]);
      setTestResult({
        ok: true,
        text: `Conectado: ${found.models.length} modelo(s) de chat e ${found.embedding_models.length} de embedding.`,
      });
    } catch (err) {
      setTestResult({ ok: false, text: err instanceof Error ? err.message : "Falha no teste." });
    } finally {
      setBusy(false);
    }
  };

  const testEmbeddings = async () => {
    setBusy(true);
    setEmbResult(null);
    try {
      const dims = await api.testEmbeddings(input());
      setEmbResult({ ok: true, text: `Funcionando: vetores com ${dims} dimensões.` });
    } catch (err) {
      setEmbResult({ ok: false, text: err instanceof Error ? err.message : "Falha no teste." });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.saveLLMSettings(input()));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogFrame title="Configurar o Biblo" onClose={onClose} wide>
      <form
        className="settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={!loaded}>
          <legend>Modelo de linguagem</legend>
          <label>
            <span>Endereço da API</span>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1" /* ds-allow-url: exemplo exibido, não é recurso carregado */
              spellCheck={false}
              required
            />
            <small>
              Qualquer servidor compatível com a API da OpenAI: LiteLLM, Ollama (<code>http://host.docker.internal:11434/v1</code>), {/* ds-allow-url: exemplo exibido, não é recurso carregado */}
              OpenAI, OpenRouter e afins. A chamada sai da API do Biblo, não do navegador.
            </small>
          </label>
          <label>
            <span>Token (API key)</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={loaded?.has_api_key ? "Token salvo. Deixe em branco para manter." : "Sem token"}
              autoComplete="off"
              disabled={clearToken}
            />
            {loaded?.has_api_key && (
              <span className="settings-check">
                <input type="checkbox" checked={clearToken} onChange={(e) => setClearToken(e.target.checked)} />
                Remover o token salvo
              </span>
            )}
            <small>O token fica salvo só no servidor do Biblo e nunca volta para o navegador.</small>
          </label>
          <label>
            <span>Modelo padrão de chat</span>
            <input
              type="text"
              list="biblo-llm-models"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Teste a conexão para listar os modelos"
              spellCheck={false}
            />
            <datalist id="biblo-llm-models">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          <div className="settings-test">
            <button type="button" className="btn btn-secondary" onClick={() => void test()} disabled={busy || !baseUrl.trim()}>
              <PlugZap size={14} /> Testar conexão
            </button>
            {testResult && (
              <span className={testResult.ok ? "test-ok" : "test-error"} role="status">
                {testResult.ok && <CheckCircle2 size={14} aria-hidden="true" />} {testResult.text}
              </span>
            )}
          </div>
        </fieldset>

        <fieldset disabled={!loaded}>
          <legend>Busca semântica (embeddings)</legend>
          <label>
            <span>Provedor</span>
            <select value={embProvider} onChange={(e) => setEmbProvider(e.target.value as EmbeddingProvider)}>
              <option value="chat">Mesmo servidor e token do chat</option>
              <option value="ollama">Ollama local</option>
              <option value="none">Desativado (só busca textual)</option>
            </select>
          </label>
          {embProvider !== "none" && (
            <label>
              <span>Modelo de embedding</span>
              <input
                type="text"
                list="biblo-embedding-models"
                value={embModel}
                onChange={(e) => setEmbModel(e.target.value)}
                placeholder={embProvider === "chat" ? "Ex.: models/gemini-embedding-001" : "Ex.: nomic-embed-text"}
                spellCheck={false}
              />
              <datalist id="biblo-embedding-models">
                {embModels.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <small>
                O índice usa vetores de {loaded?.embedding_dim ?? 768} dimensões; o Biblo pede esse tamanho ao servidor. Ao trocar o
                modelo, os vetores antigos são descartados e todos os documentos são vetorizados de novo.
              </small>
            </label>
          )}
          {embProvider !== "none" && (
            <div className="settings-test">
              <button type="button" className="btn btn-secondary" onClick={() => void testEmbeddings()} disabled={busy || !embModel.trim()}>
                <PlugZap size={14} /> Testar embeddings
              </button>
              {embResult && (
                <span className={embResult.ok ? "test-ok" : "test-error"} role="status">
                  {embResult.ok && <CheckCircle2 size={14} aria-hidden="true" />} {embResult.text}
                </span>
              )}
            </div>
          )}
        </fieldset>

        <fieldset disabled={!loaded}>
          <legend>Prompt guia</legend>
          <label>
            <span>Personalidade e formato das respostas</span>
            <textarea
              value={guide}
              onChange={(e) => setGuide(e.target.value.slice(0, GUIDE_LIMIT))}
              placeholder={GUIDE_EXAMPLE}
              rows={7}
            />
            <small>
              {guide.length}/{GUIDE_LIMIT}. Vale para todas as conversas. As regras fixas do Biblo continuam valendo: responder
              com base nos materiais da biblioteca e citar as fontes.
            </small>
          </label>
        </fieldset>

        {error && <div className="field-error" role="alert">{error}</div>}
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !loaded}>Salvar</button>
        </div>
      </form>
    </DialogFrame>
  );
}
