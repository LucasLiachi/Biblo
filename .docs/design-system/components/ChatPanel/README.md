# ChatPanel (Pergunte para o Biblo)

`web/src/components/ChatPanel.tsx`, `LLMSettingsDialog.tsx` · classes `.chat-panel`, `.chat-header`, `.chat-messages`, `.chat-bubble-user`, `.chat-bubble-ai`, `.ai-streaming-cursor`, `.chat-input-box`, `.chat-textarea` (+ `.chat-scope`, `.settings-form` em `app.css`)

"Pergunte para o Biblo" é o chat do app: o Biblo responde com base nos materiais da biblioteca.

| Elemento | Comportamento |
| :--- | :--- |
| Cabeçalho | Título "Pergunte para o Biblo"; engrenagem (configurar), limpar conversa, fechar |
| Escopo | Seletor "Biblioteca": a biblioteca do documento ativo (padrão), outra biblioteca ou "Todas as bibliotecas" |
| Modelo | Só modelos de chat de `GET /api/models`; o modelo padrão da configuração vem selecionado (se não estiver na lista, vale o primeiro) |
| Sem servidor de LLM | Aviso com o erro da API e os botões "Configurar" e "Tentar de novo"; campo de mensagem desabilitado |
| Mensagens | Usuário à direita (`--accent-primary`); Biblo em Markdown sanitizado, sem imagens, com cursor de streaming |
| Fontes | `CitationBadge` para cada trecho enviado ao modelo; `[caminho.md]` no texto vira link |
| Avisos | "Nenhum trecho da biblioteca foi encontrado…", "Busca só textual: embeddings indisponíveis", erros do modelo |
| Entrada | `Enter` envia, `Shift+Enter` quebra linha; "Parar" cancela o stream |

O histórico enviado é limitado às últimas 20 mensagens.

## Configurar o Biblo (engrenagem)

| Campo | Uso |
| :--- | :--- |
| Endereço da API | Servidor compatível com a API da OpenAI (LiteLLM, Ollama `/v1`, OpenAI, OpenRouter…) |
| Token (API key) | Salvo só no servidor; em branco mantém o atual; há opção para remover |
| Modelo padrão de chat | Com sugestões dos modelos de chat encontrados em "Testar conexão" |
| Busca semântica | Provedor (mesmo servidor do chat, Ollama local ou desativado) e modelo de embedding, com "Testar embeddings"; vetores de 768 dimensões; trocar o modelo revetoriza os documentos |
| Prompt guia | Até 4.000 caracteres sobre personalidade e formato das respostas; vale para todas as conversas |

"Testar conexão" valida endereço e token sem salvar.

Acessibilidade: região de mensagens com `aria-live="polite"`; o diálogo usa `role="dialog"` e fecha com `Esc`.
