# Design system do Biblo

Fonte única de tokens, estilos de componentes e marca do app `web/`. O app usa cópias geradas destes arquivos
(ver [GOVERNANCA.md](GOVERNANCA.md)).

| Arquivo | Conteúdo |
| :--- | :--- |
| `tokens.css` | Variáveis CSS do tema escuro (`:root`, `[data-theme="dark"]`) e do claro (`[data-theme="light"]`) |
| `tokens.json` | Os tokens de cor com o uso de cada um, mais os pares de contraste verificados (`color.contrastPairs`) |
| `components/bundle.css` | Estilos dos componentes; `components/<Nome>/README.md` e `preview.html` documentam cada um |
| `layout-e-ux.md` | Layout, fluxos e acessibilidade |
| `brand/` | Marca (coruja): SVGs, PNGs e regras ([brand/README.md](brand/README.md)) |
| `Corujas minimalistas.pdf` | Referência dos estilos de coruja; a marca usa o estilo 02 (sólido) |

## Princípios

- **Disco é a verdade**: a interface mostra o estado real do vault e do índice, inclusive falhas.
- **Tema escuro como padrão**, tema claro equivalente; ambos com contraste WCAG 2.1 AA verificado.
- **Cores com significado fixo**: primário (ações), IA (copiloto), canvas (diagramas), wikilink (links entre notas),
  status (sucesso, aviso, perigo).
- **Teclado completo**: atalhos fora dos reservados do navegador e foco visível em todos os controles.

## Tokens

| Grupo | Tokens |
| :--- | :--- |
| Superfícies | `--background`, `--panel-bg`, `--workspace-bg`, `--card-bg`, `--canvas-bg`, `--input-bg`, `--overlay-bg` |
| Texto | `--foreground`, `--muted-foreground`, `--muted`, `--on-accent` |
| Acentos (preenchimento) | `--accent-primary`, `--accent-primary-hover`, `--accent-ai`, `--accent-canvas`, `--accent-wikilink` e os `*-bg` |
| Acentos (texto) | `--accent-primary-fg`, `--accent-ai-fg`, `--accent-canvas-fg`, `--accent-wikilink-fg` |
| Status | `--status-success`, `--status-warning`, `--status-danger`, com `*-bg` e `*-fg` |
| Interação | `--border`, `--input-border`, `--tree-hover`, `--tree-active`, `--focus-ring` |
| Marca | `--brand-ink`, `--brand-amber`, `--brand-paper` |
| Tipografia | `--font-sans` (Inter), `--font-mono` (JetBrains Mono), `--text-xs` a `--text-3xl` |
| Espaço e forma | `--space-*` (base 4 px), `--radius-*`, `--shadow-*`, `--transition-*`, `--z-*` |
| Dimensões | `--header-height` 44 px, `--tab-height` 38 px, `--statusbar-height` 28 px, `--sidebar-vault-default` 260 px, `--sidebar-chat-default` 360 px |

As fontes Inter e JetBrains Mono vêm de `@fontsource`, empacotadas no build.

## Componentes

| Componente | Arquivo no app |
| :--- | :--- |
| [AppHeader](components/AppHeader/README.md) | `components/AppHeader.tsx` |
| [VaultTree](components/VaultTree/README.md) | `components/VaultTree.tsx` |
| [DocumentTabs](components/DocumentTabs/README.md) | `components/DocumentTabs.tsx` |
| [Breadcrumb](components/Breadcrumb/README.md) | `components/Breadcrumb.tsx` |
| [MarkdownEditor](components/MarkdownEditor/README.md) | `components/MarkdownEditor.tsx`, `MarkdownPreview.tsx` |
| [Canvas](components/CanvasToolbar/README.md) | `components/DiagramCanvas.tsx` |
| [ChatPanel](components/ChatPanel/README.md) | `components/ChatPanel.tsx` |
| [CitationBadge](components/CitationBadge/README.md) | `components/CitationBadge.tsx` |
| [CommandPalette](components/CommandPalette/README.md) | `components/CommandPalette.tsx` |
| [SyncIndicator](components/SyncIndicator/README.md) | `components/SyncIndicator.tsx` |
| [Button](components/Button/README.md) | classes `.btn-*` |

Layout, diálogos e preview de Markdown ficam em `web/src/styles/app.css`, que também só usa tokens.

## Atalhos

| Ação | Mac | Windows/Linux |
| :--- | :--- | :--- |
| Busca e comandos | `Cmd K` | `Ctrl K` |
| Salvar agora | `Cmd S` | `Ctrl S` |
| Fechar aba do documento | `Option W` | `Alt W` |
| Painel do vault | `Cmd Shift B` | `Ctrl Shift B` |
| Painel do copiloto | `Cmd Shift L` | `Ctrl Shift L` |
| Modo foco (oculta as laterais) | `Cmd Shift F` | `Ctrl Shift F` |
| Negrito / itálico / código (editor) | `Cmd B` / `I` / `E` | `Ctrl B` / `I` / `E` |
| Buscar no texto (editor) | `Cmd F` | `Ctrl F` |
| Abrir `[[wikilink]]` (editor) | `Cmd` + clique | `Ctrl` + clique |
| Renomear / excluir (árvore) | `F2` / `Delete` | `F2` / `Delete` |
