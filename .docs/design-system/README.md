# 📚 Biblo Design System — Knowledge Studio Local-First

O **Biblo Design System** é o guia oficial de tokens, padrões de interface e biblioteca de componentes do **Biblo**, o espaço de trabalho integrado (*Knowledge Studio*) para ideação visual, escrita de notas em Markdown com links bidirecionais e copiloto de IA aumentado por RAG Híbrido em localhost.

Este recurso projeta e documenta todas as decisões visuais e de interação que sustentam a aplicação web (React 19 + Vite + Tailwind CSS), garantindo consistência, ergonomia em sessões longas de trabalho intelectual e máxima clareza entre o que está gravado em disco (`./vault/`), o que é desenhado no Canvas infinito e o que é indexado pela inteligência artificial.

---

## 💡 Princípios Fundamentais de Design

1. **Local-First & Transparência do Disco**
   - O arquivo em `./vault/` é a única fonte da verdade. A interface nunca esconde o estado real do filesystem.
   - Indicadores de autosave silencioso (debounce de 1.5s), sincronização do Watchdog e hashing de integridade transmitem segurança imediata contra perda de dados.

2. **Ergonomia de Estúdio e Modo Foco**
   - Projetado prioritariamente em **Dark Mode refinado** (slate profundo), reduzindo fadiga ocular em telas grandes. O **Light Mode** é igualmente polido e atende a padrões estritos de contraste.
   - Interface tripartite (Vault · Canvas/Editor · Chat IA) com capacidade de recolhimento dos painéis laterais em modo Zen (`Cmd/Ctrl+B` e `Cmd/Ctrl+J`).

3. **IA Contextualizada e Rastreável (Zero Alucinação Oculta)**
   - Respostas da IA, streaming de tokens via SSE e badges de inteligência possuem identidade visual própria (acento violeta).
   - Toda referência textual ou de diagrama gerada pela IA deve renderizar uma **Citação Clicável** (`[notas/arch.md]` ou `[diagramas/fluxo.excalidraw]`), permitindo navegação instantânea para o documento fonte.

4. **Densidade Profissional com Acessibilidade Rigorosa**
   - Interface de alta densidade de informação inspirada em ferramentas como Obsidian e VS Code, sem sacrificar legibilidade.
   - Conformidade com **WCAG 2.1 AA**: taxas de contraste superiores a 4.5:1 para texto e 3:1 para controles visuais, estados de foco universais (`:focus-visible`), suporte a leitores de tela e navegação total por teclado com atalhos universais.

---

## 🎨 Fundamentos Visuais

### 1. Cores e Semântica de Acentos
O Biblo adota uma base neutra ardósia (*Slate*) enriquecida por acentos semânticos de significado unívoco:

| Token Semântico | Dark Mode | Light Mode | Aplicação e Significado |
| :--- | :--- | :--- | :--- |
| `--background` | `#090d16` | `#f8fafc` | Fundo estrutural da aplicação |
| `--panel-bg` | `#0f1422` | `#f1f5f9` | Painéis laterais (Vault Tree e Chat IA) |
| `--workspace-bg` | `#0b0f19` | `#ffffff` | Área central de trabalho (Editor e Canvas) |
| `--card-bg` | `#161e31` | `#ffffff` | Modais, menus flutuantes, popovers e tooltips |
| `--foreground` | `#f1f5f9` | `#0f172a` | Texto de alta ênfase e títulos |
| `--muted-foreground`| `#94a3b8` | `#475569` | Textos secundários, descrições e atalhos de teclado |
| `--border` | `#1e293b` | `#e2e8f0` | Divisórias entre painéis e contornos sutis |
| **`--accent-primary`** | `#6366f1` | `#4f46e5` | Ações primárias do sistema, botões de salvar, seleções ativas |
| **`--accent-ai`** | `#8b5cf6` | `#7c3aed` | Respostas da IA, cursor de streaming SSE, modelo ativo, badges RAG |
| **`--accent-canvas`** | `#06b6d4` | `#0891b2` | Ferramentas do Excalidraw, formas geométricas, seleções visuais |
| **`--accent-wikilink`**| `#38bdf8` | `#0284c7` | Links bidirecionais `[[wikilinks]]` e referências cruzadas |
| **`--status-success`** | `#10b981` | `#059669` | Watchdog sincronizado, arquivo gravado em disco |
| **`--status-warning`** | `#f59e0b` | `#d97706` | Autosave em progresso (debounce 1.5s), indexação em andamento |
| **`--status-danger`** | `#ef4444` | `#dc2626` | Conflito de versão em disco, erro de conexão, deleção |

### 2. Tipografia
- **Interface & Leitura Geral**: `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  - Pesos: 400 (corpo), 500 (labels e botões), 600 (abas e destaques), 700 (títulos).
- **Código, Markdown, Wikilinks & Dados Técnicos**: `"JetBrains Mono", "Fira Code", monospace`
  - Utilizado em blocos de código do editor, frontmatter YAML, caminhos do vault, badges de citação e nós semânticos de diagramas.

### 3. Sistema de Espaçamento e Dimensões de Estúdio
Escala modular base 4px:
- `--space-1` (0.25rem / 4px): Micro-gaps de ícones e badges.
- `--space-2` (0.5rem / 8px): Gap de botões compactos, espaçamento de itens da árvore.
- `--space-3` (0.75rem / 12px): Padding interno de inputs e botões padrão.
- `--space-4` (1rem / 16px): Espaçamento padrão de painéis e barras de ferramentas.
- `--space-6` (1.5rem / 24px): Padding do editor de texto e painel de chat.
- **Larguras de Painéis**:
  - Painel Vault: `260px` padrão (min: `200px`, max: `420px`).
  - Painel Chat IA: `360px` padrão (min: `300px`, max: `560px`).
  - Cabeçalho Superior: `44px` fixo.

### 4. Sombras, Elevações e Profundidade
- Superfícies em camadas com contorno de borda (`1px solid var(--border)`) para separação nítida em monitores OLED/IPS escuros.
- `shadow-floating`: `0 8px 24px rgba(0, 0, 0, 0.35)` para barra de ferramentas do Excalidraw e paleta de comandos.
- `shadow-modal`: `0 20px 48px rgba(0, 0, 0, 0.5)` para caixas de diálogo e busca `Cmd+K`.

---

## 🧩 Catálogo de Componentes do Biblo

O diretório `components/` contém os blocos modulares essenciais do Biblo, cada um com sua documentação e visualização em `preview.html`:

| Componente | Função no Biblo |
| :--- | :--- |
| **`AppHeader`** | Barra superior: logo, indicador do `./vault`, status de indexação Watchdog, alternância de painéis e tema. |
| **`VaultTree`** | Navegador de arquivos com pastas expansíveis, ícones para `.md`, `.excalidraw` e assets, e contadores de links. |
| **`DocumentTabs`** | Abas do documento ativo, estado de alteração/salvamento e alternador de visualização (Editor, Canvas ou Split). |
| **`CanvasToolbar`** | Barra flutuante de ferramentas de desenho do Excalidraw com controles de zoom e indicador de autosave. |
| **`MarkdownEditor`** | Área de escrita com suporte a frontmatter YAML, links bidirecionais `[[nota]]` e blocos de código. |
| **`ChatPanel`** | Copiloto de IA com RAG híbrido: streaming SSE, seletor de modelo (Claude/Gemini/Ollama) e citações clicáveis. |
| **`CitationBadge`** | Pílula interativa para fontes citadas pela IA e wikilinks com preview e navegação direta. |
| **`CommandPalette`** | Omnibar (`Cmd+K`) para busca rápida de notas, diagramas e execução de atalhos. |
| **`SyncIndicator`** | Indicador em tempo real de integridade do disco, debounce de salvamento e reindexação pgvector. |
| **`Button`** | Botões de ação com variantes primária, secundária, fantasma, ícone e destrutiva com suporte a teclas `kbd`. |
| **`Breadcrumb`** | Navegação por migalhas de pão no sistema de arquivos do vault (`vault > notas > backend > auth.md`). |

---

## ⌨️ Atalhos de Teclado Universais

| Ação | Atalho Mac | Atalho Windows/Linux |
| :--- | :--- | :--- |
| Alternar Painel do Vault | `Cmd + B` | `Ctrl + B` |
| Alternar Painel de Chat com IA | `Cmd + J` | `Ctrl + J` |
| Paleta de Comandos / Busca Rápida | `Cmd + K` | `Ctrl + K` |
| Salvar Documento Imediatamente | `Cmd + S` | `Ctrl + S` |
| Alternar Modo Canvas / Editor | `Cmd + E` | `Ctrl + E` |
| Modo Foco (Ocultar laterais) | `Cmd + Shift + F` | `Ctrl + Shift + F` |
