# AppHeader

`web/src/components/AppHeader.tsx` · classes `.app-header`, `.app-brand`, `.header-center`, `.header-actions`

Barra superior de 44 px (`--header-height`).

| Região | Conteúdo |
| :--- | :--- |
| Esquerda | Coruja (`BrandMark`) e nome "Biblo" |
| Centro | Botão "Buscar nas bibliotecas" com `Ctrl K` (abre a CommandPalette) |
| Direita | `SyncIndicator`, reconstruir índice, painel de bibliotecas (`Ctrl/Cmd+Shift+B`), Pergunte para o Biblo (`Ctrl/Cmd+Shift+L`), tema |

Acessibilidade: `<header>`; botões de ícone com `aria-label`; os alternadores de painel usam `aria-pressed`.
