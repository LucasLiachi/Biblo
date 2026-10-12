# CitationBadge — Biblo Design System

O componente **CitationBadge** é a peça fundamental de rastreabilidade do Biblo. Ele representa as fontes citadas pelo copiloto de IA durante a resposta do RAG Híbrido, garantindo que o usuário saiba exatamente de qual arquivo em disco (`.md` ou `.excalidraw`) aquela informação foi extraída.

---

## 🏷️ Variantes

| Classe | Tipo de Documento | Visual |
| :--- | :--- | :--- |
| `.citation-badge` | Nota Markdown (`.md`) | Ícone `📄`, fundo violeta sutil, texto em `--accent-ai` |
| `.citation-badge-canvas` | Diagrama Excalidraw (`.excalidraw`) | Ícone `🎨`, fundo ciano sutil, texto em `--accent-canvas` |

---

## ⚡ Comportamento Interativo
- **Clique**: Abre imediatamente o arquivo correspondente no Painel 2 (Área de Trabalho Central).
- **Hover**: Elevação suave de 1px e inversão para a cor cheia do acento.
- **Tooltip**: Exibe o trecho exato (*chunk*) do documento que serviu de contexto para a IA.

---

## ♿ Acessibilidade
- Elemento interativo com `role="link"` ou `<a>`.
- O caminho do arquivo é renderizado em fonte monoespaçada legível com contraste conforme WCAG 2.1 AA.

