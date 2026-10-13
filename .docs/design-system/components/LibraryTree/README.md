# LibraryTree

`web/src/components/LibraryTree.tsx` · classes `.library-tree`, `.tree-header`, `.tree-list`, `.tree-item`, `.tree-item.active`, `.tree-icon-md`, `.tree-icon-canvas`, `.tree-icon-folder` (+ `.tree-library`, `.tree-icon-library`, `.tree-onboarding` em `app.css`)

Espelha `./bibliotecas`. No primeiro nível só existem **bibliotecas**: pastas mestras, cada uma com materiais dedicados.
Dentro delas ficam pastas, notas, diagramas e imagens (pastas primeiro, ordem alfabética, sem itens ocultos). As pastas
abertas ficam salvas, e a pasta do documento ativo abre sozinha.

| Nível | Ações |
| :--- | :--- |
| Área das bibliotecas | Só "Nova biblioteca": botão do cabeçalho, clique direito na área vazia ou botão do estado vazio |
| Biblioteca | Nova nota, novo diagrama, nova pasta. Não é renomeada, movida nem excluída pela interface; recebe itens arrastados |
| Pasta, nota, diagrama | Nova nota/diagrama/pasta (pastas), renomear (`F2`), excluir (`Delete`, vai para `<biblioteca>/.lixeira/`), arrastar para outra pasta ou biblioteca |

Outros comandos:
- **Filtrar**: campo "Filtrar arquivos…" (por nome).
- **Abrir**: clique, `Enter` ou `Espaço`. Imagens aparecem, mas não abrem.
- **Menu de contexto**: clique direito, tecla `ContextMenu` ou `Shift+F10`.

Acessibilidade: `role="tree"`, `role="treeitem"` com `aria-expanded`/`aria-selected`, `role="group"` nos filhos.
