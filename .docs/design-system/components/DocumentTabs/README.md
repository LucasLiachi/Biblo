# DocumentTabs — Biblo Design System

O componente **DocumentTabs** gerencia os documentos atualmente abertos na área de trabalho central do Biblo Studio. Ele unifica abas de notas em Markdown e diagramas do Excalidraw, além de fornecer o alternador de visualização (*Modo Editor*, *Modo Canvas* ou *Modo Split*).

---

## 📑 Recursos e Estados

1. **Abas Multi-formato**:
   - Ícone correspondente ao tipo de arquivo (`📄 .md` ou `🎨 .excalidraw`).
   - Título do arquivo com truncamento gracioso em telas menores.
2. **Indicador de Alteração / Dirty Dot (`.doc-dirty-dot`)**:
   - Ponto âmbar exibido durante a digitação e antes da conclusão do autosave em disco (debounce 1.5s).
3. **Botão Fechar (`.doc-close-btn`)**:
   - Ícone compacto com confirmação imediata caso não haja conflitos.
4. **Seletor de Modo de Exibição (`.view-mode-selector`)**:
   - Alternância rápida entre:
     - **Editor**: Edição pura de Markdown (CodeMirror 6).
     - **Canvas**: Tela infinita (Excalidraw).
     - **Split**: Exibição lado a lado de nota e diagrama.

---

## ♿ Acessibilidade
- Implementado com a convenção WAI-ARIA `role="tablist"` e `role="tab"`.
- Suporte a fechamento de aba via atalho de teclado `Cmd/Ctrl+W`.

