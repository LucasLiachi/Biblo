# AppHeader

`web/src/components/AppHeader.tsx` · classes `.app-header`, `.app-brand`, `.vault-indicator`, `.header-center`, `.header-actions`

Barra superior de 44 px (`--header-height`).

| Região | Conteúdo |
| :--- | :--- |
| Esquerda | Coruja (`BrandMark`), nome "Biblo" e badge `./vault` |
| Centro | Botão "Buscar no vault" com `Ctrl K` (abre a CommandPalette) |
| Direita | `SyncIndicator`, reconstruir índice, alternar vault (`Ctrl/Cmd+Shift+B`), alternar copiloto (`Ctrl/Cmd+Shift+L`), alternar tema |

Acessibilidade: `<header>`; botões de ícone com `aria-label`; os alternadores de painel usam `aria-pressed`.
