# VaultTree

`web/src/components/VaultTree.tsx` · classes `.vault-tree`, `.tree-header`, `.tree-list`, `.tree-item`, `.tree-item.active`, `.tree-icon-md`, `.tree-icon-canvas`, `.tree-icon-folder`

Espelha `./vault`: pastas primeiro, ordem alfabética, sem itens ocultos. As pastas abertas ficam salvas, e a pasta do
documento ativo abre sozinha.

| Ação | Como |
| :--- | :--- |
| Filtrar | Campo "Filtrar arquivos…" (por nome) |
| Nova nota / diagrama / pasta | Botões do cabeçalho (raiz), botões da linha da pasta, menu de contexto |
| Abrir | Clique, `Enter` ou `Espaço` (imagens aparecem, mas não abrem) |
| Renomear | `F2` ou menu de contexto |
| Excluir | `Delete` ou menu de contexto, com confirmação (vai para `vault/.lixeira/`) |
| Mover | Arrastar para uma pasta ou para a área vazia (raiz) |
| Menu de contexto | Clique direito, tecla `ContextMenu` ou `Shift+F10` |

Acessibilidade: `role="tree"`, `role="treeitem"` com `aria-expanded`/`aria-selected`, `role="group"` nos filhos.
