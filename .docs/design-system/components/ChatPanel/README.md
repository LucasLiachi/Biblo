# ChatPanel — Biblo Design System

O componente **ChatPanel** é o copiloto conversacional do Biblo. Ele conecta o usuário à IA e ao motor de **RAG Híbrido Unificado**, permitindo fazer perguntas contextuais que cruzam o conteúdo de notas em Markdown e os grafos relacionais extraídos dos diagramas do Excalidraw.

---

## 🤖 Elementos e Interações

1. **Header do Chat & Seletor de Modelo**:
   - Badge com o provedor/modelo ativo (Claude 3.5 Sonnet, Gemini 2.0 Flash ou Ollama Local).
2. **Bolhas de Mensagem (`.chat-bubble`)**:
   - Usuário (`.chat-bubble-user`): alinhado à direita, fundo acento primário.
   - IA (`.chat-bubble-ai`): alinhado à esquerda, fundo card, contorno com `--border`.
3. **Cursor de Streaming SSE (`.ai-streaming-cursor`)**:
   - Cursor pulsante animado em violeta (`--accent-ai`), indicando que novos tokens estão sendo recebidos via Server-Sent Events.
4. **Citações RAG Clicáveis**:
   - Cada trecho citado renderiza uma pílula interativa conectada ao documento em disco.
5. **Área de Entrada com Auto-Resize**:
   - Textarea com redimensionamento de altura e envio via tecla `Enter` (`Shift+Enter` para nova linha).

---

## ♿ Acessibilidade
- Região de mensagens configurada com `aria-live="polite"` para anúncio acessível de streaming.
- Botão "Parar Resposta" acessível via teclado para cancelar o streaming a qualquer momento.

