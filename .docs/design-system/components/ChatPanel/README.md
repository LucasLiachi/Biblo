# ChatPanel (copiloto)

`web/src/components/ChatPanel.tsx` · classes `.chat-panel`, `.chat-header`, `.chat-messages`, `.chat-bubble-user`, `.chat-bubble-ai`, `.ai-streaming-cursor`, `.chat-input-box`, `.chat-textarea`

| Elemento | Comportamento |
| :--- | :--- |
| Cabeçalho | Seletor com os modelos de `GET /api/models` (o escolhido fica salvo); limpar conversa; fechar |
| Sem gateway | Aviso com o erro da API e "Tentar de novo"; campo de mensagem desabilitado |
| Mensagens | Usuário à direita (`--accent-primary`); IA em Markdown sanitizado, sem imagens, com cursor de streaming |
| Fontes | `CitationBadge` para cada trecho enviado ao modelo; `[caminho.md]` no texto vira link |
| Avisos | "Nenhum trecho do vault foi encontrado…", "Busca só textual: embeddings indisponíveis", erros do modelo |
| Entrada | `Enter` envia, `Shift+Enter` quebra linha; "Parar" cancela o stream |

O histórico enviado é limitado às últimas 20 mensagens. Acessibilidade: região de mensagens com `aria-live="polite"`.
