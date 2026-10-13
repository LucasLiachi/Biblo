# MarkdownEditor

`web/src/components/MarkdownEditor.tsx`, `MarkdownPreview.tsx` · classes `.view-mode-selector`, `.view-mode-btn`, `.wikilink` (+ `.cm-host`, `.md-preview`, `.side-panel` em `app.css`)

| Parte | Comportamento |
| :--- | :--- |
| Editor | CodeMirror 6: Markdown, números de linha, histórico, busca (`Ctrl/Cmd+F`), quebra de linha |
| Wikilinks | Destacados; autocomplete ao digitar `[[`; `Ctrl/Cmd+clique` abre; resolvidos e sugeridos só dentro da mesma biblioteca; alvo inexistente oferece criar a nota |
| Barra | Negrito, itálico, título, lista, tarefa, código, wikilink, tabela, fluxograma Mermaid, imagem (envia para `<biblioteca>/assets`) |
| Atalhos do editor | `Ctrl/Cmd+B` negrito, `+I` itálico, `+E` código |
| Modos | Editar, Dividido, Visualizar (a escolha fica salva) |
| Preview | Markdown sanitizado, checklists clicáveis, Mermaid, imagens só da própria biblioteca, frontmatter oculto |
| Painel lateral (à esquerda do texto) | Estrutura (títulos), Backlinks e Links de saída (do índice); o botão no início da barra mostra ou oculta |
| Rodapé | Estado da gravação, linha/coluna, palavras |
